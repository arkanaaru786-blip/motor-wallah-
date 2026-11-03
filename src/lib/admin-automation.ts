import { replicaRead, replicaWrite } from "@/lib/cloud-store";

/**
 * MW Autopilot — the rule engine behind the control room.
 *
 * A rule is a trigger, a set of conditions and one or more actions. Rules live
 * in Supabase alongside the case table (see cloud-store), and every action goes
 * through the same CRM write gates as a human edit, attributed to the
 * `MW Autopilot` actor. Nothing here can bypass `admin-rbac.ts`.
 *
 * Sweeps are explicit: the panel runs one when it opens (and from the Rules
 * page), which stands in for a scheduler until the data lives on a server.
 * Each (rule, target, bucket) is marked once it succeeds, so a page reload
 * never re-assigns the same lead or re-notifies the same manager.
 */
import {
  addCaseNote,
  assignCase,
  ensureAdminDatabase,
  isOpenStatus,
  logAudit,
  setCasePriority,
  slaFor,
  type AdminEmployee,
  type CasePriority,
  type CaseType,
  type CrmCase,
  type CrmSnapshot,
} from "./admin-crm";
import {
  canViewCase,
  canManageAutomation,
  departmentForCaseType,
  canViewAutomation,
  departmentCovers,
  ruleDepartmentFor,
  type Actor,
  type Department,
} from "./admin-rbac";

/* ------------------------------------------------------------- vocabulary */

export const TRIGGERS = [
  "lead.created",
  "followup.due",
  "sla.breached",
  "subscription.expiring",
] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABEL: Record<Trigger, string> = {
  "lead.created": "New lead created",
  "followup.due": "Follow-up due",
  "sla.breached": "SLA breached",
  "subscription.expiring": "Subscription expiring",
};

export const TRIGGER_HINT: Record<Trigger, string> = {
  "lead.created": "Fires the moment a case lands in the tracker, before anyone touches it.",
  "followup.due":
    "Fires while a case is still inside its promise window, so the nudge lands early.",
  "sla.breached": "Fires once a case is past its due time and needs an escalation.",
  "subscription.expiring": "Fires when a dealer plan on the renewal watchlist is about to lapse.",
};

export type RuleAction =
  | { kind: "assign"; target: "desk-manager" | "employee"; employeeId: string | null }
  | { kind: "notify"; to: "admins" | "desk-manager" | "assignee" }
  | { kind: "priority"; value: CasePriority }
  | { kind: "note"; text: string };

export const ACTION_LABEL: Record<RuleAction["kind"], string> = {
  assign: "Auto-assign",
  notify: "Send notification",
  priority: "Set priority",
  note: "Add a note",
};

export type RuleConditions = {
  /** Empty means “any business line”. */
  types: CaseType[];
  /** Empty means “any priority”. */
  priorities: CasePriority[];
  unassignedOnly: boolean;
  /** Window in days, only used by the follow-up and renewal triggers. */
  withinDays: number | null;
};

export type AutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: RuleConditions;
  actions: RuleAction[];
  /** null = every department (super admin rules); a manager's rules stay on their desk. */
  department: Department | null;
  origin: "demo" | "admin";
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  runs: number;
  successes: number;
  failures: number;
};

export type RunEntry = {
  id: string;
  at: string;
  ruleId: string;
  ruleName: string;
  trigger: Trigger;
  target: string;
  outcome: "success" | "failure";
  detail: string;
};

export type Notification = {
  id: string;
  at: string;
  ruleId: string;
  ruleName: string;
  title: string;
  body: string;
  to: "admins" | "desk-manager" | "assignee";
  department: Department | null;
  employeeId: string | null;
  target: string;
  read: boolean;
};

export type Subscription = {
  id: string;
  dealer: string;
  plan: string;
  seats: number;
  /** ISO date the plan lapses. */
  renewsAt: string;
  mobile: string;
};

export type AutopilotState = {
  lastSweepAt: string | null;
  lastFired: number;
  lastSucceeded: number;
  lastFailed: number;
};

/* ---------------------------------------------------------------- storage */

const RULES_KEY = "mw_admin_rules_v1";
const RUNS_KEY = "mw_admin_rule_runs_v1";
const NOTIFY_KEY = "mw_admin_notifications_v1";
const SUBS_KEY = "mw_admin_subscriptions_v1";
const STATE_KEY = "mw_admin_autopilot_state_v1";
const SEEDED_KEY = "mw_admin_autopilot_seeded_v1";
const SWEEP_THROTTLE_MS = 60_000;
/** A single sweep never floods the log: at most this many targets per rule. */
const MAX_TARGETS_PER_RULE = 10;
const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
const uid = (prefix: string) => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
};

function read<T>(key: string, fallback: T): T {
  return replicaRead<T>(key, fallback);
}

function write(key: string, value: unknown): boolean {
  return replicaWrite(key, value);
}

const EMPTY_CONDITIONS: RuleConditions = {
  types: [],
  priorities: [],
  unassignedOnly: false,
  withinDays: 1,
};

/* ----------------------------------------------------------------- seeds */

const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const DEMO_RULES: AutomationRule[] = [
  {
    id: "RULE-01",
    name: "Finance intake → desk manager",
    enabled: true,
    trigger: "lead.created",
    conditions: { ...EMPTY_CONDITIONS, types: ["Finance"], unassignedOnly: true, withinDays: null },
    actions: [
      { kind: "assign", target: "desk-manager", employeeId: null },
      { kind: "notify", to: "desk-manager" },
    ],
    department: null,
    origin: "demo",
    createdBy: { id: "OWNER-1", name: "Owner" },
    createdAt: new Date(Date.now() - 6 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 6 * DAY).toISOString(),
    lastRunAt: null,
    runs: 0,
    successes: 0,
    failures: 0,
  },
  {
    id: "RULE-02",
    name: "SLA breach → escalate to Critical",
    enabled: true,
    trigger: "sla.breached",
    conditions: { ...EMPTY_CONDITIONS, priorities: [], unassignedOnly: false, withinDays: null },
    actions: [
      { kind: "priority", value: "Critical" },
      { kind: "notify", to: "admins" },
    ],
    department: null,
    origin: "demo",
    createdBy: { id: "OWNER-1", name: "Owner" },
    createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 5 * DAY).toISOString(),
    lastRunAt: null,
    runs: 0,
    successes: 0,
    failures: 0,
  },
  {
    id: "RULE-03",
    name: "Follow-up nudge one day out",
    enabled: true,
    trigger: "followup.due",
    conditions: {
      ...EMPTY_CONDITIONS,
      types: [],
      priorities: [],
      unassignedOnly: false,
      withinDays: 1,
    },
    actions: [
      { kind: "note", text: "Autopilot: follow-up window is closing — call the customer today." },
      { kind: "notify", to: "assignee" },
    ],
    department: null,
    origin: "demo",
    createdBy: { id: "OWNER-1", name: "Owner" },
    createdAt: new Date(Date.now() - 4 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 4 * DAY).toISOString(),
    lastRunAt: null,
    runs: 0,
    successes: 0,
    failures: 0,
  },
  {
    id: "RULE-04",
    name: "Dealer plan renewal reminder",
    enabled: true,
    trigger: "subscription.expiring",
    conditions: {
      ...EMPTY_CONDITIONS,
      types: [],
      priorities: [],
      unassignedOnly: false,
      withinDays: 7,
    },
    actions: [{ kind: "notify", to: "admins" }],
    department: null,
    origin: "demo",
    createdBy: { id: "OWNER-1", name: "Owner" },
    createdAt: new Date(Date.now() - 3 * DAY).toISOString(),
    updatedAt: new Date(Date.now() - 3 * DAY).toISOString(),
    lastRunAt: null,
    runs: 0,
    successes: 0,
    failures: 0,
  },
];

const DEMO_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "SUB-01",
    dealer: "Sharma Motors",
    plan: "Marketplace Pro",
    seats: 8,
    renewsAt: isoIn(3),
    mobile: "9811002233",
  },
  {
    id: "SUB-02",
    dealer: "Coastal Autohub",
    plan: "Service Suite",
    seats: 4,
    renewsAt: isoIn(5),
    mobile: "9822004455",
  },
  {
    id: "SUB-03",
    dealer: "Highway Cars",
    plan: "Finance Desk",
    seats: 12,
    renewsAt: isoIn(19),
    mobile: "9833006677",
  },
];

/** Seeds the demo rules and renewal watchlist once per device. */
export function ensureAutopilot(): void {
  if (typeof window === "undefined") return;
  if (read<string | null>(SEEDED_KEY, null)) return;
  write(RULES_KEY, DEMO_RULES);
  write(SUBS_KEY, DEMO_SUBSCRIPTIONS);
  write(SEEDED_KEY, new Date().toISOString());
}

/* --------------------------------------------------------------- reading */

export const listRules = (): AutomationRule[] => read<AutomationRule[]>(RULES_KEY, []);

export const listRuns = (): RunEntry[] => read<RunEntry[]>(RUNS_KEY, []);

export const listNotifications = (): Notification[] => read<Notification[]>(NOTIFY_KEY, []);

export const listSubscriptions = (): Subscription[] => read<Subscription[]>(SUBS_KEY, []);

export const autopilotState = (): AutopilotState =>
  read<AutopilotState>(STATE_KEY, {
    lastSweepAt: null,
    lastFired: 0,
    lastSucceeded: 0,
    lastFailed: 0,
  });

/** Rules a person may see: a manager sees their desk's rules plus shared ones. */
export function visibleRules(actor: Actor, rules = listRules()): AutomationRule[] {
  if (actor.role === "super_admin") return rules;
  return rules.filter((rule) => rule.department === null || rule.department === actor.department);
}

/** Rules a person may run: writes, so the manager gate applies. */
function runnableRules(actor: Actor, rules = listRules()): AutomationRule[] {
  if (actor.role === "super_admin") return rules;
  if (!actor.department) return [];
  return rules.filter((rule) => rule.department === null || rule.department === actor.department);
}

/* -------------------------------------------------------------- refusals */

function deny(actor: Actor, attempted: string, reason: string): { ok: false; error: string } {
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "automation.denied",
    target: "Autopilot",
    summary: `attempted to ${attempted} — refused: ${reason}`,
    department: actor.department,
    outcome: "denied",
  });
  return { ok: false, error: reason };
}

/* ----------------------------------------------------------------- rules */

export type RuleInput = {
  name: string;
  trigger: Trigger;
  conditions: RuleConditions;
  actions: RuleAction[];
  enabled: boolean;
};

export function validateRule(input: RuleInput): string | null {
  if (input.name.trim().length < 3) return "Give the rule a name of at least 3 characters.";
  if (!TRIGGERS.includes(input.trigger)) return "Choose a trigger.";
  if (input.actions.length === 0) return "Add at least one action.";
  const note = input.actions.find((action) => action.kind === "note");
  if (note && note.kind === "note" && note.text.trim().length < 3) {
    return "Write the note the rule should add.";
  }
  const assign = input.actions.find((action) => action.kind === "assign");
  if (assign && assign.kind === "assign" && assign.target === "employee" && !assign.employeeId) {
    return "Pick the employee this rule assigns to, or use the desk manager.";
  }
  const repeats = new Set(input.actions.map((action) => action.kind));
  if (repeats.size !== input.actions.length) return "Use each action only once per rule.";
  return null;
}

function sanitise(input: RuleInput): RuleInput {
  return {
    name: input.name.trim().replace(/\s+/g, " ").slice(0, 70),
    trigger: input.trigger,
    enabled: input.enabled,
    conditions: {
      types: [...input.conditions.types],
      priorities: [...input.conditions.priorities],
      unassignedOnly: input.conditions.unassignedOnly,
      withinDays: input.conditions.withinDays,
    },
    actions: input.actions.map((action) => ({ ...action })),
  };
}

const nextRuleId = (rules: AutomationRule[]) => {
  const highest = rules.reduce((max, rule) => {
    const parsed = Number.parseInt(rule.id.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return `RULE-${String(highest + 1).padStart(2, "0")}`;
};

export function createRule(
  actor: Actor,
  input: RuleInput,
): { ok: true; rule: AutomationRule } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(
      actor,
      "create an automation rule",
      "Only managers and super admins can build rules.",
    );
  }
  const problem = validateRule(input);
  if (problem) return { ok: false, error: problem };

  ensureAutopilot();
  const clean = sanitise(input);
  const rules = listRules();
  const department = ruleDepartmentFor(actor);
  // A manager cannot author a rule that reaches outside their own desk.
  const outOfScope = clean.conditions.types.some(
    (type) => department !== null && !departmentCovers(department, type),
  );
  if (outOfScope) {
    return deny(
      actor,
      `create the rule “${clean.name}”`,
      `A ${department} manager cannot write rules for another desk.`,
    );
  }

  const rule: AutomationRule = {
    ...clean,
    id: nextRuleId(rules),
    department,
    origin: "admin",
    createdBy: { id: actor.id, name: actor.name },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    runs: 0,
    successes: 0,
    failures: 0,
  };
  write(RULES_KEY, [...rules, rule]);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.create",
    target: rule.id,
    summary: `created the rule “${rule.name}” (${TRIGGER_LABEL[rule.trigger]})`,
    department: rule.department,
    outcome: "allowed",
  });
  return { ok: true, rule };
}

export function updateRule(
  actor: Actor,
  id: string,
  input: RuleInput,
): { ok: true; rule: AutomationRule } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(actor, "edit an automation rule", "Your role cannot change automation rules.");
  }
  const problem = validateRule(input);
  if (problem) return { ok: false, error: problem };

  const rules = listRules();
  const current = rules.find((rule) => rule.id === id);
  if (!current) return { ok: false, error: "That rule no longer exists." };
  if (actor.role !== "super_admin" && current.department !== actor.department) {
    return deny(
      actor,
      "edit a rule from another desk",
      "Rules are limited to your own department.",
    );
  }

  const clean = sanitise(input);
  const updated: AutomationRule = { ...current, ...clean, updatedAt: new Date().toISOString() };
  write(
    RULES_KEY,
    rules.map((rule) => (rule.id === id ? updated : rule)),
  );
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.update",
    target: id,
    summary: `edited the rule “${updated.name}”`,
    department: updated.department,
    outcome: "allowed",
  });
  return { ok: true, rule: updated };
}

export function setRuleEnabled(
  actor: Actor,
  id: string,
  enabled: boolean,
): { ok: true } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(actor, "switch a rule", "Your role cannot change automation rules.");
  }
  const rules = listRules();
  const current = rules.find((rule) => rule.id === id);
  if (!current) return { ok: false, error: "That rule no longer exists." };
  if (actor.role !== "super_admin" && current.department !== actor.department) {
    return deny(
      actor,
      "switch a rule from another desk",
      "Rules are limited to your own department.",
    );
  }
  write(
    RULES_KEY,
    rules.map((rule) =>
      rule.id === id ? { ...rule, enabled, updatedAt: new Date().toISOString() } : rule,
    ),
  );
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.toggle",
    target: id,
    summary: `${enabled ? "switched on" : "paused"} the rule “${current.name}”`,
    department: current.department,
    outcome: "allowed",
  });
  return { ok: true };
}

export function deleteRule(actor: Actor, id: string): { ok: true } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(actor, "delete a rule", "Your role cannot change automation rules.");
  }
  const rules = listRules();
  const current = rules.find((rule) => rule.id === id);
  if (!current) return { ok: false, error: "That rule no longer exists." };
  if (actor.role !== "super_admin" && current.department !== actor.department) {
    return deny(
      actor,
      "delete a rule from another desk",
      "Rules are limited to your own department.",
    );
  }
  write(
    RULES_KEY,
    rules.filter((rule) => rule.id !== id),
  );
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.delete",
    target: id,
    summary: `deleted the rule “${current.name}”`,
    department: current.department,
    outcome: "allowed",
  });
  return { ok: true };
}

/* --------------------------------------------------------- subscriptions */

export function addSubscription(
  actor: Actor,
  input: { dealer: string; plan: string; seats: number; renewsAt: string; mobile: string },
): { ok: true; subscription: Subscription } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(
      actor,
      "add a renewal",
      "Only managers and super admins manage the renewal watchlist.",
    );
  }
  const dealer = input.dealer.trim();
  if (dealer.length < 2) return { ok: false, error: "Name the dealer." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewsAt))
    return { ok: false, error: "Pick a renewal date." };
  const seats = Number(input.seats);
  if (!Number.isFinite(seats) || seats < 1)
    return { ok: false, error: "Seats must be at least 1." };

  const subs = listSubscriptions();
  const subscription: Subscription = {
    id: `SUB-${String(subs.length + 1).padStart(2, "0")}`,
    dealer,
    plan: input.plan.trim() || "Marketplace Pro",
    seats: Math.round(seats),
    renewsAt: new Date(`${input.renewsAt}T09:00:00`).toISOString(),
    mobile: input.mobile.trim() || "—",
  };
  write(SUBS_KEY, [...subs, subscription]);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.update",
    target: subscription.id,
    summary: `put ${dealer} on the renewal watchlist (${subscription.plan})`,
    department: actor.department,
    outcome: "allowed",
  });
  return { ok: true, subscription };
}

export function removeSubscription(
  actor: Actor,
  id: string,
): { ok: true } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(
      actor,
      "remove a renewal",
      "Only managers and super admins manage the renewal watchlist.",
    );
  }
  const subs = listSubscriptions();
  const current = subs.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That renewal is already gone." };
  write(
    SUBS_KEY,
    subs.filter((item) => item.id !== id),
  );
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "rule.update",
    target: id,
    summary: `removed ${current.dealer} from the renewal watchlist`,
    department: actor.department,
    outcome: "allowed",
  });
  return { ok: true };
}

export const daysUntil = (isoDate: string, reference = Date.now()) =>
  Math.ceil((Date.parse(isoDate) - reference) / DAY);

/* --------------------------------------------------------------- engine */

export const SYSTEM_ACTOR: Actor = {
  id: "AUTOPILOT",
  name: "MW Autopilot",
  email: "autopilot@motorwallah.in",
  role: "super_admin",
  department: null,
};

export type PlannedRun = {
  rule: AutomationRule;
  target: string;
  kind: "case" | "subscription";
  detail: string;
};

type DedupeRecord = { key: string; at: string };

const DEDUPE_KEY = "mw_admin_autopilot_marks_v1";

const readMarks = (): DedupeRecord[] => read<DedupeRecord[]>(DEDUPE_KEY, []);

const bucketFor = (trigger: Trigger) => {
  if (trigger === "lead.created") return "once";
  const today = new Date();
  return `day:${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

const markKey = (rule: AutomationRule, target: string) =>
  `${rule.id}|${target}|${bucketFor(rule.trigger)}`;

/** Cases a rule can act on, already limited to the rule's own desk. */
function caseCandidates(
  rule: AutomationRule,
  snapshot: CrmSnapshot,
  at: number,
  scope: Department | null,
): CrmCase[] {
  return snapshot.cases.filter((item) => {
    if (rule.department && !departmentCovers(rule.department, item.type)) return false;
    if (scope && !departmentCovers(scope, item.type)) return false;
    if (!canViewCase(SYSTEM_ACTOR, item)) return false;
    if (rule.conditions.types.length && !rule.conditions.types.includes(item.type)) return false;
    if (rule.conditions.priorities.length && !rule.conditions.priorities.includes(item.priority)) {
      return false;
    }
    if (rule.conditions.unassignedOnly && item.assignedTo) return false;

    if (rule.trigger === "lead.created") return item.status === "New" || item.origin === "imported";
    if (!isOpenStatus(item.status)) return false;

    if (rule.trigger === "sla.breached") return slaFor(item, at).state === "Overdue";
    if (rule.trigger === "followup.due") {
      const sla = slaFor(item, at);
      const window = (rule.conditions.withinDays ?? 1) * 24;
      return sla.state === "Due soon" || (sla.hoursLeft > 0 && sla.hoursLeft <= window);
    }
    return false;
  });
}

/** What a sweep would do right now — used by the preview and by the run itself. */
export function planSweep(
  actor: Actor,
  options: { ruleId?: string; now?: number } = {},
): PlannedRun[] {
  if (!canViewAutomation(actor)) return [];
  ensureAutopilot();
  const snapshot = ensureAdminDatabase();
  const at = options.now ?? Date.now();
  const marks = new Set(readMarks().map((mark) => mark.key));
  const planned: PlannedRun[] = [];

  for (const rule of runnableRules(actor)) {
    if (!rule.enabled) continue;
    if (options.ruleId && rule.id !== options.ruleId) continue;

    if (rule.trigger === "subscription.expiring") {
      const window = rule.conditions.withinDays ?? 7;
      for (const sub of listSubscriptions()) {
        const left = daysUntil(sub.renewsAt, at);
        if (left > window) continue;
        if (marks.has(markKey(rule, sub.id))) continue;
        planned.push({
          rule,
          target: sub.id,
          kind: "subscription",
          detail: `${sub.dealer} · ${sub.plan} renews in ${left} day${left === 1 ? "" : "s"}`,
        });
      }
      continue;
    }

    let handled = 0;
    for (const item of caseCandidates(
      rule,
      snapshot,
      at,
      actor.role === "super_admin" ? null : actor.department,
    )) {
      if (marks.has(markKey(rule, item.id))) continue;
      if (handled >= MAX_TARGETS_PER_RULE) break;
      handled += 1;
      planned.push({
        rule,
        target: item.id,
        kind: "case",
        detail:
          rule.trigger === "lead.created"
            ? `${item.type} lead for ${item.customerName}`
            : `${item.id} · ${item.type} · ${slaFor(item, at).label}`,
      });
    }
  }
  return planned;
}

function activeManager(
  employees: AdminEmployee[],
  department: Department | null,
): AdminEmployee | null {
  if (!department) return null;
  return (
    employees.find(
      (employee) =>
        employee.department === department &&
        employee.role === "manager" &&
        employee.status === "Active",
    ) ?? null
  );
}

type ActionResult = { ok: true; detail: string } | { ok: false; detail: string };

function performAction(
  rule: AutomationRule,
  action: RuleAction,
  target: { kind: "case"; item: CrmCase } | { kind: "subscription"; sub: Subscription },
  employees: AdminEmployee[],
): ActionResult {
  const deskOf = (item: CrmCase) => departmentForCaseType(item.type);

  if (action.kind === "notify") {
    const department = target.kind === "case" ? deskOf(target.item) : null;
    const employee =
      action.to === "assignee" && target.kind === "case" && target.item.assignedTo
        ? target.item.assignedTo
        : action.to === "desk-manager"
          ? (activeManager(employees, department)?.id ?? null)
          : null;
    const title =
      target.kind === "case"
        ? `${target.item.id} · ${target.item.type} — ${target.item.customerName}`
        : `${target.sub.dealer} · ${target.sub.plan}`;
    const notifications = listNotifications();
    write(
      NOTIFY_KEY,
      [
        {
          id: uid("ntf"),
          at: new Date().toISOString(),
          ruleId: rule.id,
          ruleName: rule.name,
          title,
          body:
            target.kind === "case"
              ? `${rule.name} · ${TRIGGER_LABEL[rule.trigger]} on ${target.item.id} (${target.item.type}).`
              : `${rule.name} · ${target.sub.plan} renews in ${daysUntil(target.sub.renewsAt)} day(s).`,
          to: action.to,
          department,
          employeeId: employee,
          target: target.kind === "case" ? target.item.id : target.sub.id,
          read: false,
        },
        ...notifications,
      ].slice(0, 200),
    );
    return {
      ok: true,
      detail:
        action.to === "admins"
          ? "notification queued for every admin"
          : action.to === "desk-manager"
            ? employee
              ? "notification queued for the desk manager"
              : "notification queued for admins (no manager on the desk)"
            : target.kind === "case" && target.item.assignedTo
              ? "notification queued for the assignee"
              : "notification queued for admins (no assignee yet)",
    };
  }

  if (target.kind === "subscription") {
    return {
      ok: false,
      detail: `${ACTION_LABEL[action.kind]} needs a case, and ${target.sub.dealer} is a renewal row.`,
    };
  }

  const item = target.item;
  if (action.kind === "assign") {
    const employee =
      action.target === "employee"
        ? (employees.find((row) => row.id === action.employeeId) ?? null)
        : activeManager(employees, deskOf(item));
    if (!employee) {
      return {
        ok: false,
        detail:
          action.target === "employee"
            ? "The chosen employee is no longer in the directory."
            : `No active manager on the ${deskOf(item) ?? "owning"} desk to hand this to.`,
      };
    }
    if (item.assignedTo === employee.id) {
      return { ok: true, detail: `already with ${employee.name}` };
    }
    const result = assignCase(item.id, employee.id, SYSTEM_ACTOR);
    return result.ok
      ? { ok: true, detail: `assigned ${item.id} to ${employee.name}` }
      : { ok: false, detail: result.error ?? "Assignment refused." };
  }

  if (action.kind === "priority") {
    if (item.priority === action.value) {
      return { ok: true, detail: `priority already ${action.value}` };
    }
    const result = setCasePriority(item.id, action.value, SYSTEM_ACTOR);
    return result.ok
      ? { ok: true, detail: `${item.id} raised to ${action.value}` }
      : { ok: false, detail: result.error ?? "Priority change refused." };
  }

  const result = addCaseNote(item.id, action.text, SYSTEM_ACTOR);
  return result.ok
    ? { ok: true, detail: `note added to ${item.id}` }
    : { ok: false, detail: result.error ?? "Note refused." };
}

export type SweepResult = {
  at: string;
  dryRun: boolean;
  planned: PlannedRun[];
  entries: RunEntry[];
  succeeded: number;
  failed: number;
};

/**
 * Runs the rules. A dry run reports what would happen without touching a case,
 * which is what the “Preview” button on the Rules page shows.
 */
export function sweepAutomation(
  actor: Actor,
  options: { dryRun?: boolean; ruleId?: string; force?: boolean; now?: number } = {},
): { ok: true; result: SweepResult } | { ok: false; error: string } {
  if (!canManageAutomation(actor)) {
    return deny(actor, "run the autopilot", "Only managers and super admins can run rules.");
  }
  ensureAutopilot();
  const at = options.now ?? Date.now();
  const planned = planSweep(actor, {
    ...(options.ruleId ? { ruleId: options.ruleId } : {}),
    now: at,
  });

  const base: SweepResult = {
    at: new Date(at).toISOString(),
    dryRun: options.dryRun ?? false,
    planned,
    entries: [],
    succeeded: 0,
    failed: 0,
  };
  if (options.dryRun) return { ok: true, result: base };

  const snapshot = ensureAdminDatabase();
  const entries: RunEntry[] = [];
  const marks = readMarks();
  const rules = listRules();
  const touched = new Map<string, { runs: number; successes: number; failures: number }>();

  for (const run of planned) {
    const item =
      run.kind === "case"
        ? (() => {
            const found = snapshot.cases.find((row) => row.id === run.target);
            return found ? { kind: "case" as const, item: found } : null;
          })()
        : (() => {
            const found = listSubscriptions().find((row) => row.id === run.target);
            return found ? { kind: "subscription" as const, sub: found } : null;
          })();
    if (!item) continue;

    const details: string[] = [];
    let failed = false;
    for (const action of run.rule.actions) {
      const outcome = performAction(run.rule, action, item, snapshot.employees);
      details.push(`${ACTION_LABEL[action.kind]}: ${outcome.detail}`);
      if (!outcome.ok) failed = true;
    }

    const entry: RunEntry = {
      id: uid("run"),
      at: new Date(at).toISOString(),
      ruleId: run.rule.id,
      ruleName: run.rule.name,
      trigger: run.rule.trigger,
      target: run.target,
      outcome: failed ? "failure" : "success",
      detail: details.join(" · "),
    };
    entries.push(entry);
    // A failed run keeps its mark open, so the next sweep retries it.
    if (!failed) marks.push({ key: markKey(run.rule, run.target), at: entry.at });

    const stats = touched.get(run.rule.id) ?? { runs: 0, successes: 0, failures: 0 };
    stats.runs += 1;
    stats[failed ? "failures" : "successes"] += 1;
    touched.set(run.rule.id, stats);
  }

  write(RUNS_KEY, [...entries.reverse(), ...listRuns()].slice(0, 400));
  write(DEDUPE_KEY, marks.slice(-800));
  write(
    RULES_KEY,
    rules.map((rule) => {
      const stats = touched.get(rule.id);
      if (!stats) return rule;
      return {
        ...rule,
        runs: rule.runs + stats.runs,
        successes: rule.successes + stats.successes,
        failures: rule.failures + stats.failures,
        lastRunAt: new Date(at).toISOString(),
      };
    }),
  );

  const succeeded = entries.filter((entry) => entry.outcome === "success").length;
  const failed = entries.length - succeeded;
  write(STATE_KEY, {
    lastSweepAt: new Date(at).toISOString(),
    lastFired: entries.length,
    lastSucceeded: succeeded,
    lastFailed: failed,
  } satisfies AutopilotState);

  if (entries.length) {
    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "rule.run",
      target: "Autopilot",
      summary: `ran the autopilot: ${succeeded} success${succeeded === 1 ? "" : "es"}, ${failed} failure${failed === 1 ? "" : "s"}`,
      department: actor.department,
      outcome: failed ? "denied" : "allowed",
    });
  }

  return { ok: true, result: { ...base, entries, succeeded, failed } };
}

/**
 * Sweeps at most once a minute, so opening the dashboard twice does not replay
 * every rule. The panel calls this on load — the stand-in for a cron worker.
 */
export function maybeSweep(actor: Actor): SweepResult | null {
  if (!canManageAutomation(actor)) return null;
  const state = autopilotState();
  if (state.lastSweepAt && Date.now() - Date.parse(state.lastSweepAt) < SWEEP_THROTTLE_MS) {
    return null;
  }
  const result = sweepAutomation(actor);
  return result.ok ? result.result : null;
}

/* ----------------------------------------------------------- notification */

export function notificationsFor(
  actor: Actor,
  notifications = listNotifications(),
): Notification[] {
  if (actor.role === "super_admin") return notifications;
  if (actor.role === "manager") {
    return notifications.filter(
      (note) =>
        note.employeeId === actor.id ||
        note.to === "admins" ||
        (note.department !== null && note.department === actor.department),
    );
  }
  return notifications.filter((note) => note.employeeId === actor.id);
}
