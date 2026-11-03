/**
 * MW Intelligence — the assistant in the dashboard.
 *
 * This is a deterministic, on-device answer engine: no model, no network call,
 * no key. It reads the same scoped snapshot the dashboard renders and matches
 * the question against a small set of intents (overdue work, unowned work,
 * workload, revenue, approvals, renewals). The panel labels it as a demo so
 * nobody mistakes it for a hosted model.
 *
 * Because every answer is built from `visibleCases(actor, …)`, the assistant can
 * never reveal a case the person asking is not allowed to open.
 */
import {
  CASE_TYPES,
  adminKpis,
  employeeName,
  ensureAdminDatabase,
  inr,
  isOpenStatus,
  openCasesFor,
  relativeTime,
  slaFor,
  visibleAudit,
  visibleCases,
  type CaseType,
  type CrmCase,
} from "./admin-crm";
import { canManageAutomation } from "./admin-rbac";
import { daysUntil, listSubscriptions, notificationsFor } from "./admin-automation";
import type { Actor } from "./admin-rbac";

export type AnswerRow = {
  label: string;
  meta: string;
  caseId?: string;
  tone?: "danger" | "warning" | "ok";
};

export type Answer = {
  at: string;
  question: string;
  intent: string;
  headline: string;
  bullets: string[];
  rows: AnswerRow[];
  followUps: string[];
};

export const ENGINE_LABEL = "Demo engine · rule-based, runs on your device";

const TYPE_ALIASES: { type: CaseType; words: string[] }[] = [
  { type: "Finance", words: ["finance", "loan", "disbursal", "finance desk"] },
  { type: "Insurance", words: ["insurance", "policy", "claim", "renewal policy"] },
  { type: "Service", words: ["service", "workshop", "repair"] },
  { type: "Parts Order", words: ["parts", "spare"] },
  { type: "Decor Order", words: ["decor", "accessory", "accessories"] },
  { type: "Sell", words: ["sell", "selling", "selling car"] },
  { type: "Exchange", words: ["exchange"] },
  { type: "Test Drive", words: ["test drive", "testdrive"] },
  { type: "Franchise", words: ["franchise", "partner"] },
  { type: "Scrap", words: ["scrap"] },
  { type: "Vehicle Enquiry", words: ["enquiry", "inquiry", "listing"] },
];

const mentionsType = (text: string): CaseType | null => {
  for (const entry of TYPE_ALIASES) {
    if (entry.words.some((word) => text.includes(word))) return entry.type;
  }
  return null;
};

const has = (text: string, ...words: string[]) => words.some((word) => text.includes(word));

export const SUGGESTIONS = [
  "Show all overdue finance leads",
  "Which employee has the most pending tasks?",
  "Which cases have no owner?",
  "How much revenue is closed?",
  "What is waiting for approval?",
  "Which dealer plans are expiring?",
];

const caseRow = (item: CrmCase, meta: string, tone?: AnswerRow["tone"]): AnswerRow => ({
  label: `${item.id} · ${item.customerName}`,
  meta,
  caseId: item.id,
  ...(tone ? { tone } : {}),
});

/**
 * Answers a question from the scoped snapshot. Pure: same question and same
 * data produce the same answer, which keeps it testable.
 */
export function askIntelligence(question: string, actor: Actor, now = Date.now()): Answer {
  const text = question.toLowerCase().trim();
  const snapshot = ensureAdminDatabase();
  const cases = visibleCases(actor, snapshot.cases);
  const open = cases.filter((item) => isOpenStatus(item.status));
  const type = mentionsType(text);
  const scoped = type ? cases.filter((item) => item.type === type) : cases;
  const scopedOpen = scoped.filter((item) => isOpenStatus(item.status));
  const withSla = (item: CrmCase) => slaFor(item, now).state;
  /** Names the reader's scope, so "your desk" is never vague for an executive. */
  const scopePhrase = type
    ? `on the ${type} desk`
    : actor.role === "super_admin"
      ? "across every desk"
      : actor.department
        ? `on the ${actor.department} desk`
        : "in your scope";
  const base = {
    at: new Date(now).toISOString(),
    question: question.trim(),
    followUps: SUGGESTIONS,
  };

  /* ---------------------------------------------------------------- overdue */
  if (has(text, "overdue", "late", "breach", "breached", "past due")) {
    const overdue = scopedOpen.filter((item) => withSla(item) === "Overdue");
    return {
      ...base,
      intent: "overdue",
      headline: overdue.length
        ? `${overdue.length} case${overdue.length === 1 ? " is" : "s are"} overdue ${scopePhrase}.`
        : `Nothing is overdue ${scopePhrase} right now.`,
      bullets: [
        overdue.length
          ? `${inr(overdue.reduce((sum, item) => sum + item.value, 0))} of pipeline is sitting past its SLA.`
          : "Every open case is still inside its promise window.",
        `${scopedOpen.length - overdue.length} of ${scopedOpen.length} open case${scopedOpen.length === 1 ? "" : "s"} ${scopedOpen.length - overdue.length === 1 ? "is" : "are"} still on track.`,
        type ? `Filtered to ${type} cases only.` : "Every business line in your scope is included.",
      ].slice(0, 2),
      rows: overdue
        .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
        .slice(0, 6)
        .map((item) =>
          caseRow(
            item,
            `${slaFor(item, now).label} · ${type ? "" : `${item.type} · `}${
              employeeName(snapshot.employees, item.assignedTo) ?? "Unassigned"
            }`,
            "danger",
          ),
        ),
    };
  }

  /* ------------------------------------------------------------ unassigned */
  if (has(text, "no owner", "unassigned", "unowned", "not assigned", "nobody")) {
    const loose = scopedOpen.filter((item) => !item.assignedTo);
    return {
      ...base,
      intent: "unassigned",
      headline: loose.length
        ? `${loose.length} open case${loose.length === 1 ? "" : "s"} have no owner.`
        : "Every open case has an owner.",
      bullets: [
        `${scopedOpen.length} open cases in total${type ? ` on the ${type} desk` : ""}.`,
        loose.length
          ? "Assigning one takes two clicks in the Master Tracker."
          : "Nothing to chase here.",
      ],
      rows: loose
        .slice(0, 6)
        .map((item) => caseRow(item, `${item.type} · ${slaFor(item, now).label}`, "warning")),
    };
  }

  /* --------------------------------------------------------------- workload */
  if (
    has(text, "most pending", "most tasks", "busiest", "workload", "who has", "employee", "team") &&
    !has(text, "revenue", "value")
  ) {
    const load = snapshot.employees
      .map((employee) => {
        const items = cases.filter(
          (item) => item.assignedTo === employee.id && isOpenStatus(item.status),
        );
        return {
          employee,
          items,
          overdue: items.filter((item) => withSla(item) === "Overdue").length,
        };
      })
      .filter((row) => row.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length || b.overdue - a.overdue);

    const top = load[0];
    return {
      ...base,
      intent: "workload",
      headline: top
        ? `${top.employee.name} is carrying the most open work: ${top.items.length} case${top.items.length === 1 ? "" : "s"}${
            top.overdue ? `, ${top.overdue} already late` : ""
          }.`
        : "Nobody in your scope is holding an open case.",
      bullets: load.length
        ? [
            `Across ${load.length} teammate${load.length === 1 ? "" : "s"}, ${load.reduce((sum, row) => sum + row.items.length, 0)} open cases are with people.`,
            `${scopedOpen.filter((item) => !item.assignedTo).length} more are still unassigned.`,
          ]
        : ["New work is waiting in the unassigned queue."],
      rows: load.slice(0, 6).map((row) => ({
        label: `${row.employee.name} · ${row.items.length} open`,
        meta: `${row.employee.department} · ${row.employee.role.replace(/_/g, " ")}${row.overdue ? ` · ${row.overdue} late` : ""}`,
        tone: row.overdue ? "warning" : "ok",
      })),
    };
  }

  /* ---------------------------------------------------------------- revenue */
  if (has(text, "revenue", "money", "value", "won", "booked", "turnover", "₹")) {
    const kpis = adminKpis(cases, now);
    const won = cases.filter((item) => item.status === "Won");
    return {
      ...base,
      intent: "revenue",
      headline: `${inr(kpis.revenue)} is closed-won across ${kpis.revenueWon} case${kpis.revenueWon === 1 ? "" : "s"}${type ? ` on the ${type} desk` : ""}.`,
      bullets: [
        `${kpis.openCases} cases are still open, worth ${inr(open.reduce((sum, item) => sum + item.value, 0))}.`,
        `${kpis.wonRate}% of cases in scope are won.`,
      ],
      rows: won
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map((item) =>
          caseRow(item, `${inr(item.value)} · won ${relativeTime(item.updatedAt, now)}`, "ok"),
        ),
    };
  }

  /* ------------------------------------------------------------- approvals */
  if (has(text, "approval", "approve", "pending decision", "manager decision")) {
    const pending = scoped.filter(
      (item) =>
        item.status === "Awaiting Approval" || (item.approvalRequired && isOpenStatus(item.status)),
    );
    return {
      ...base,
      intent: "approvals",
      headline: pending.length
        ? `${pending.length} case${pending.length === 1 ? " needs" : "s need"} a manager decision.`
        : "Nothing is waiting for approval.",
      bullets: [
        `${pending.filter((item) => !item.assignedTo).length} of them have no owner yet.`,
        pending.length
          ? "Approvals are the slowest step in the pipeline today."
          : "The approval queue is clear.",
      ],
      rows: pending
        .slice(0, 6)
        .map((item) =>
          caseRow(item, `${item.type} · ${inr(item.value)} · ${item.status}`, "warning"),
        ),
    };
  }

  /* -------------------------------------------------------- subscriptions */
  if (has(text, "dealer plan", "expiring", "renewal", "subscription", "plan")) {
    const subs = listSubscriptions()
      .map((sub) => ({ sub, left: daysUntil(sub.renewsAt, now) }))
      .sort((a, b) => a.left - b.left);
    const soon = subs.filter((row) => row.left <= 7);
    return {
      ...base,
      intent: "renewals",
      headline: soon.length
        ? `${soon.length} dealer plan${soon.length === 1 ? "" : "s"} lapse within a week.`
        : "No dealer plan lapses in the next seven days.",
      bullets: [
        `The watchlist holds ${subs.length} plan${subs.length === 1 ? "" : "s"}.`,
        soon.length
          ? `Earliest: ${soon[0]!.sub.dealer} in ${soon[0]!.left} day${soon[0]!.left === 1 ? "" : "s"}.`
          : "Next renewal is further out.",
      ],
      rows: subs.slice(0, 6).map((row) => ({
        label: `${row.sub.dealer} · ${row.sub.plan}`,
        meta: `${row.left <= 0 ? "lapsed" : `renews in ${row.left} day${row.left === 1 ? "" : "s"}`} · ${row.sub.seats} seats`,
        tone: row.left <= 7 ? "danger" : "ok",
      })),
    };
  }

  /* ------------------------------------------------------------- activity */
  if (has(text, "activity", "recent", "what happened", "who did", "log")) {
    const entries = visibleAudit(actor, snapshot.audit).slice(0, 5);
    return {
      ...base,
      intent: "activity",
      headline: entries.length
        ? `The last recorded action was “${entries[0]!.summary}”.`
        : "No activity has been recorded yet.",
      bullets: [`${snapshot.audit.length} entries exist in the log overall.`],
      rows: entries.map((entry) => ({
        label: `${entry.actorName} · ${relativeTime(entry.at, now)}`,
        meta: entry.summary,
      })),
    };
  }

  /* ---------------------------------------------------------------- today */
  if (has(text, "today", "new lead", "new case", "this week", "fresh")) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const fresh = scoped.filter((item) => Date.parse(item.createdAt) >= start.getTime());
    return {
      ...base,
      intent: "today",
      headline: `${fresh.length} case${fresh.length === 1 ? "" : "s"} arrived today ${scopePhrase}.`,
      bullets: [
        `${fresh.filter((item) => item.status === "New").length} are still marked New.`,
        `${fresh.filter((item) => !item.assignedTo).length} have no owner.`,
      ],
      rows: fresh
        .slice(0, 6)
        .map((item) => caseRow(item, `${item.type} · ${item.status} · ${item.source}`, "ok")),
    };
  }

  /* ---------------------------------------------------------------- counts */
  if (has(text, "how many", "count", "total", "pipeline", "open")) {
    const byType = CASE_TYPES.map((caseType) => ({
      caseType,
      count: cases.filter((item) => item.type === caseType && isOpenStatus(item.status)).length,
    })).filter((row) => row.count > 0);
    return {
      ...base,
      intent: "counts",
      headline: `${open.length} open cases are ${scopePhrase} right now.`,
      bullets: [
        `${cases.filter((item) => item.status === "Won").length} won · ${cases.filter((item) => item.status === "Lost").length} lost.`,
        `${open.filter((item) => withSla(item) === "Overdue").length} of the open ones are overdue.`,
      ],
      rows: byType.map((row) => ({
        label: `${row.caseType} · ${row.count} open`,
        meta: "Business line breakdown",
      })),
    };
  }

  /* -------------------------------------------------------------- fallback */
  const owner = snapshot.employees.find((employee) => employee.id === actor.id);
  return {
    ...base,
    intent: "help",
    headline: "I can answer questions about the work in your scope.",
    bullets: [
      `You are ${actor.name}${owner ? ` (${owner.id})` : ""} — ${actor.role.replace(/_/g, " ")}${actor.department ? ` · ${actor.department}` : ""}.`,
      `${open.length} open cases and ${snapshot.employees.length} employees are readable by you.`,
      "Try one of the suggestions below, or name a desk (“finance”) with a question.",
    ],
    rows: SUGGESTIONS.slice(0, 4).map((suggestion) => ({
      label: suggestion,
      meta: "Tap to ask",
    })),
  };
}

/** Small summary strip shown next to the assistant. */
export function intelligencePulse(actor: Actor, now = Date.now()) {
  const snapshot = ensureAdminDatabase();
  const cases = visibleCases(actor, snapshot.cases);
  const open = cases.filter((item) => isOpenStatus(item.status));
  const overdue = open.filter((item) => slaFor(item, now).state === "Overdue").length;
  const mine = openCasesFor(cases, actor.id).length;
  const notes = notificationsFor(actor).length;
  return {
    open: open.length,
    overdue,
    mine,
    assignments: snapshot.employees.filter(
      (employee) => employee.department === actor.department || actor.role === "super_admin",
    ).length,
    notifications: notes,
    canManage: canManageAutomation(actor),
  };
}
