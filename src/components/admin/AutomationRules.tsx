import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Filter,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  ACTION_LABEL,
  TRIGGERS,
  TRIGGER_HINT,
  TRIGGER_LABEL,
  addSubscription,
  autopilotState,
  createRule,
  daysUntil,
  deleteRule,
  ensureAutopilot,
  listNotifications,
  listRuns,
  listRules,
  listSubscriptions,
  notificationsFor,
  planSweep,
  removeSubscription,
  setRuleEnabled,
  sweepAutomation,
  updateRule,
  visibleRules,
  type AutomationRule,
  type RuleAction,
  type RuleInput,
  type Trigger,
} from "@/lib/admin-automation";
import {
  CASE_PRIORITIES,
  CASE_TYPES,
  ensureAdminDatabase,
  relativeTime,
  type CasePriority,
  type CaseType,
} from "@/lib/admin-crm";
import {
  ROLE_LABEL,
  actorFromSession,
  canManageAutomation,
  canViewReliability,
  scopeLabel,
  visibleCaseTypes,
} from "@/lib/admin-rbac";
import { inspect, lastReport, repairFindings } from "@/lib/admin-reconcile";
import type { AdminSession } from "@/lib/admin-auth";

type Draft = {
  id: string | null;
  name: string;
  trigger: Trigger;
  types: CaseType[];
  priorities: CasePriority[];
  unassignedOnly: boolean;
  withinDays: number;
  enabled: boolean;
  assign: boolean;
  assignTarget: "desk-manager" | "employee";
  employeeId: string;
  notify: boolean;
  notifyTo: "admins" | "desk-manager" | "assignee";
  priority: boolean;
  priorityValue: CasePriority;
  note: boolean;
  noteText: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  trigger: "lead.created",
  types: [],
  priorities: [],
  unassignedOnly: true,
  withinDays: 1,
  enabled: true,
  assign: true,
  assignTarget: "desk-manager",
  employeeId: "",
  notify: true,
  notifyTo: "desk-manager",
  priority: false,
  priorityValue: "High",
  note: false,
  noteText: "",
});

const draftFromRule = (rule: AutomationRule): Draft => {
  const assign = rule.actions.find((action) => action.kind === "assign");
  const notify = rule.actions.find((action) => action.kind === "notify");
  const priority = rule.actions.find((action) => action.kind === "priority");
  const note = rule.actions.find((action) => action.kind === "note");
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    types: [...rule.conditions.types],
    priorities: [...rule.conditions.priorities],
    unassignedOnly: rule.conditions.unassignedOnly,
    withinDays: rule.conditions.withinDays ?? 1,
    enabled: rule.enabled,
    assign: Boolean(assign),
    assignTarget: assign?.kind === "assign" ? assign.target : "desk-manager",
    employeeId: assign?.kind === "assign" ? (assign.employeeId ?? "") : "",
    notify: Boolean(notify),
    notifyTo: notify?.kind === "notify" ? notify.to : "desk-manager",
    priority: Boolean(priority),
    priorityValue: priority?.kind === "priority" ? priority.value : "High",
    note: Boolean(note),
    noteText: note?.kind === "note" ? note.text : "",
  };
};

function toInput(draft: Draft): RuleInput {
  const actions: RuleAction[] = [];
  if (draft.assign) {
    actions.push({
      kind: "assign",
      target: draft.assignTarget,
      employeeId: draft.assignTarget === "employee" ? draft.employeeId : null,
    });
  }
  if (draft.notify) actions.push({ kind: "notify", to: draft.notifyTo });
  if (draft.priority) actions.push({ kind: "priority", value: draft.priorityValue });
  if (draft.note) actions.push({ kind: "note", text: draft.noteText });
  return {
    name: draft.name,
    trigger: draft.trigger,
    enabled: draft.enabled,
    conditions: {
      types: draft.types,
      priorities: draft.priorities,
      unassignedOnly: draft.unassignedOnly,
      withinDays:
        draft.trigger === "lead.created" || draft.trigger === "sla.breached"
          ? null
          : draft.withinDays,
    },
    actions,
  };
}

const conditionSummary = (rule: AutomationRule) => {
  const bits: string[] = [];
  bits.push(rule.conditions.types.length ? rule.conditions.types.join(", ") : "Any business line");
  if (rule.conditions.priorities.length) bits.push(rule.conditions.priorities.join("/"));
  if (rule.conditions.unassignedOnly) bits.push("unassigned only");
  if (rule.conditions.withinDays !== null) bits.push(`within ${rule.conditions.withinDays}d`);
  return bits.join(" · ");
};

const actionSummary = (action: RuleAction) => {
  if (action.kind === "assign") {
    return action.target === "desk-manager"
      ? "Assign to desk manager"
      : `Assign to ${action.employeeId ?? "employee"}`;
  }
  if (action.kind === "notify") return `Notify ${action.to.replace("-", " ")}`;
  if (action.kind === "priority") return `Priority → ${action.value}`;
  return `Note: “${action.text.slice(0, 24)}${action.text.length > 24 ? "…" : ""}”`;
};

export function AutomationRules({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const manage = canManageAutomation(actor);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [triggerFilter, setTriggerFilter] = useState<Trigger | "all">("all");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "success" | "failure">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ ruleId: string; rows: string[] } | null>(null);
  const [subForm, setSubForm] = useState({
    dealer: "",
    plan: "Marketplace Pro",
    seats: "4",
    renewsAt: "",
    mobile: "",
  });

  useEffect(() => ensureAutopilot(), []);
  useEffect(() => {
    if (canViewReliability(actor)) inspect(actor, { audit: false });
    setVersion((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rules = useMemo(() => visibleRules(actor, listRules()), [actor, version]);
  const runs = useMemo(() => listRuns(), [version]);
  const subs = useMemo(() => listSubscriptions(), [version]);
  const notes = useMemo(
    () => notificationsFor(actor, listNotifications()).slice(0, 8),
    [actor, version],
  );
  const report = useMemo(() => lastReport(), [version]);
  const state = useMemo(() => autopilotState(), [version]);
  const employees = useMemo(() => ensureAdminDatabase().employees, [version]);
  const deskTypes = useMemo(() => {
    const allowed = visibleCaseTypes(actor);
    return CASE_TYPES.filter((type) => allowed.includes(type));
  }, [actor]);

  const filteredRules = rules.filter((rule) => {
    if (triggerFilter !== "all" && rule.trigger !== triggerFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${rule.id} ${rule.name} ${TRIGGER_LABEL[rule.trigger]} ${conditionSummary(rule)}`;
    return haystack.toLowerCase().includes(query.trim().toLowerCase());
  });

  const filteredRuns = runs.filter((run) => {
    if (outcomeFilter !== "all" && run.outcome !== outcomeFilter) return false;
    if (!query.trim()) return true;
    return `${run.ruleName} ${run.target} ${run.detail}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const refresh = (message?: string) => {
    setVersion((value) => value + 1);
    if (message) {
      setFlash(message);
      setError(null);
    }
  };

  const save = () => {
    if (!draft) return;
    const input = toInput(draft);
    const result = draft.id ? updateRule(actor, draft.id, input) : createRule(actor, input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(null);
    setError(null);
    setPreview(null);
    refresh(draft.id ? "Rule updated." : `Rule ${result.rule.id} created.`);
  };

  const runRule = (id: string) => {
    const result = sweepAutomation(actor, { ruleId: id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.result.entries.length === 0) {
      setFlash("Nothing matched that rule right now — no action taken.");
    } else {
      setFlash(
        `Ran ${result.result.entries.length} target(s): ${result.result.succeeded} succeeded, ${result.result.failed} failed.`,
      );
    }
    setError(null);
    refresh();
  };

  const runAll = () => {
    const result = sweepAutomation(actor);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(
      result.result.entries.length === 0
        ? "Every rule is up to date — nothing new to do."
        : `Autopilot ran ${result.result.entries.length} action(s): ${result.result.succeeded} succeeded, ${result.result.failed} failed.`,
    );
    setError(null);
    refresh();
  };

  const showPreview = (rule: AutomationRule) => {
    const planned = planSweep(actor, { ruleId: rule.id });
    setPreview({
      ruleId: rule.id,
      rows: planned.map((run) => `${run.target} — ${run.detail}`),
    });
  };

  const runCheck = () => {
    const fresh = inspect(actor);
    refresh(
      fresh.findings.length === 0
        ? "All clear — nothing missing."
        : `${fresh.findings.length} gap(s) found.`,
    );
  };

  const repair = () => {
    const result = repairFindings(actor, report);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh(
      result.result.repaired
        ? `Repaired ${result.result.repaired} item(s).`
        : (result.result.messages[0] ?? "Nothing could be repaired automatically."),
    );
  };

  return (
    <div className="mw-admin-automation" data-testid="automation-root">
      <section className="mw-admin-scope is-dash" data-testid="automation-scope">
        <span className="mw-admin-scope-icon">
          <Zap size={15} />
        </span>
        <div>
          <strong>{scopeLabel(actor)}</strong>
          <small>
            {ROLE_LABEL[actor.role]} · rules {manage ? "are editable" : "are read-only"} for you.
            {actor.department
              ? ` New rules stay inside ${actor.department}.`
              : " Rules written here can reach every desk."}
          </small>
        </div>
        <span className="mw-admin-chip is-ghost">
          {rules.filter((rule) => rule.enabled).length}/{rules.length} active
        </span>
      </section>

      <div className="mw-admin-toolbar" data-testid="automation-toolbar">
        <label className="mw-admin-search">
          <Filter size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rules, targets, details…"
            data-testid="automation-search"
          />
        </label>
        <label className="mw-admin-select">
          <select
            value={triggerFilter}
            onChange={(event) => setTriggerFilter(event.target.value as Trigger | "all")}
            data-testid="automation-trigger-filter"
            aria-label="Filter by trigger"
          >
            <option value="all">All triggers</option>
            {TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {TRIGGER_LABEL[trigger]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mw-admin-view"
          onClick={runAll}
          data-testid="automation-run-all"
          disabled={!manage}
        >
          <PlayCircle size={14} /> Run autopilot
        </button>
        <button
          type="button"
          className="mw-admin-primary"
          onClick={() => {
            setDraft(emptyDraft());
            setError(null);
          }}
          data-testid="rule-add"
          disabled={!manage}
        >
          <Plus size={15} /> New rule
        </button>
      </div>

      {flash ? (
        <p className="mw-admin-flash" data-testid="automation-flash">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-admin-error" data-testid="automation-error">
          {error}
        </p>
      ) : null}

      <section className="mw-admin-panel" aria-labelledby="rules-title">
        <header className="mw-admin-panel-head">
          <div>
            <h2 id="rules-title">
              <Sparkles size={16} /> Automation rules
            </h2>
            <p>A trigger, a condition and the work that should happen by itself.</p>
          </div>
          <span className="mw-admin-chip is-ghost" data-testid="rules-total">
            {filteredRules.length} of {rules.length}
          </span>
        </header>

        {filteredRules.length === 0 ? (
          <p className="mw-admin-empty" data-testid="rules-empty">
            No rule matches that search yet.
          </p>
        ) : (
          <div className="mw-admin-tablewrap">
            <table className="mw-admin-table mw-admin-table--rules" data-testid="rules-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger</th>
                  <th>Conditions</th>
                  <th>Actions</th>
                  <th>Health</th>
                  <th aria-label="Controls" />
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id} data-testid={`rule-row-${rule.id}`}>
                    <td data-label="Rule">
                      <strong>{rule.name}</strong>
                      <small className="mw-admin-vehicle">
                        {rule.id}
                        {rule.department ? ` · ${rule.department}` : " · all desks"}
                        {rule.origin === "demo" ? " · example" : ""}
                      </small>
                    </td>
                    <td data-label="Trigger">
                      <span className={`mw-admin-trigger is-${rule.trigger.replace(/\W+/g, "-")}`}>
                        {TRIGGER_LABEL[rule.trigger]}
                      </span>
                    </td>
                    <td data-label="Conditions">
                      <small className="mw-admin-rule-conditions">{conditionSummary(rule)}</small>
                    </td>
                    <td data-label="Actions">
                      <ul className="mw-admin-rule-actions">
                        {rule.actions.map((action, index) => (
                          <li key={`${rule.id}-${action.kind}-${index}`}>
                            {actionSummary(action)}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <span
                        className={`mw-admin-chip is-${rule.enabled ? "ok" : "muted"}`}
                        data-testid={`rule-state-${rule.id}`}
                      >
                        {rule.enabled ? "Active" : "Paused"}
                      </span>
                      <small className="mw-admin-vehicle" data-testid={`rule-stats-${rule.id}`}>
                        {rule.successes} ok · {rule.failures} failed
                      </small>
                      <small className="mw-admin-vehicle">
                        {rule.lastRunAt ? `ran ${relativeTime(rule.lastRunAt)}` : "never ran"}
                      </small>
                    </td>
                    <td>
                      <div className="mw-admin-rowactions">
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => showPreview(rule)}
                          data-testid={`rule-preview-${rule.id}`}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => runRule(rule.id)}
                          disabled={!manage || !rule.enabled}
                          data-testid={`rule-run-${rule.id}`}
                        >
                          <PlayCircle size={13} />
                        </button>
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => {
                            const result = setRuleEnabled(actor, rule.id, !rule.enabled);
                            if (!result.ok) setError(result.error);
                            else refresh(rule.enabled ? "Rule paused." : "Rule switched on.");
                          }}
                          disabled={!manage}
                          aria-label={rule.enabled ? "Pause rule" : "Switch rule on"}
                          data-testid={`rule-toggle-${rule.id}`}
                        >
                          {rule.enabled ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        </button>
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => {
                            setDraft(draftFromRule(rule));
                            setError(null);
                          }}
                          disabled={!manage}
                          data-testid={`rule-edit-${rule.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mw-admin-view is-danger"
                          onClick={() => {
                            const result = deleteRule(actor, rule.id);
                            if (!result.ok) setError(result.error);
                            else refresh("Rule deleted.");
                          }}
                          disabled={!manage || rule.origin === "demo"}
                          title={
                            rule.origin === "demo"
                              ? "Example rules cannot be deleted"
                              : "Delete rule"
                          }
                          aria-label="Delete rule"
                          data-testid={`rule-delete-${rule.id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview ? (
          <div className="mw-admin-rule-preview" data-testid="rule-preview">
            <header>
              <strong>Preview · {preview.ruleId}</strong>
              <button
                type="button"
                className="mw-admin-drawer-close"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </header>
            {preview.rows.length ? (
              <ul>
                {preview.rows.map((row) => (
                  <li key={row}>
                    <ChevronRight size={12} /> {row}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mw-admin-hint">
                Nothing matches this rule right now — it would not touch a single case.
              </p>
            )}
            <p className="mw-admin-hint">
              Preview is read-only. “Run” performs these actions and writes them to the audit log.
            </p>
          </div>
        ) : null}
      </section>

      <div className="mw-admin-bento">
        <section className="mw-admin-panel mw-admin-span-7" aria-labelledby="run-log">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="run-log">
                <ScrollText size={16} /> Execution log
              </h2>
              <p>Every action a rule took, and every action it could not finish.</p>
            </div>
            <label className="mw-admin-select is-small">
              <select
                value={outcomeFilter}
                onChange={(event) =>
                  setOutcomeFilter(event.target.value as "all" | "success" | "failure")
                }
                aria-label="Filter by outcome"
                data-testid="runs-outcome-filter"
              >
                <option value="all">All outcomes</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
          </header>

          {filteredRuns.length === 0 ? (
            <p className="mw-admin-empty" data-testid="runs-empty">
              No runs yet. The autopilot sweeps when the dashboard opens, or press “Run autopilot”.
            </p>
          ) : (
            <ul className="mw-admin-runlog" data-testid="run-log-list">
              {filteredRuns.slice(0, 12).map((run) => (
                <li key={run.id} data-testid={`run-row-${run.id}`}>
                  <span className={`mw-admin-run-dot is-${run.outcome}`} aria-hidden="true" />
                  <div>
                    <p>
                      <strong>{run.ruleName}</strong> · {run.target}
                    </p>
                    <small>{run.detail}</small>
                  </div>
                  <span className="mw-admin-runmeta">
                    <span
                      className={`mw-admin-chip is-${run.outcome === "success" ? "ok" : "danger"}`}
                    >
                      {run.outcome === "success" ? "Success" : "Failure"}
                    </span>
                    <small>{relativeTime(run.at)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mw-admin-hint">
            Showing {Math.min(filteredRuns.length, 12)} of {runs.length} runs · the log keeps the
            last 400 actions.
          </p>
        </section>

        <section className="mw-admin-panel mw-admin-span-5" aria-labelledby="outbox">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="outbox">
                <Bell size={16} /> Notification outbox
              </h2>
              <p>What the rules told the team, newest first.</p>
            </div>
            <span className="mw-admin-chip is-ghost">{notes.length}</span>
          </header>
          {notes.length === 0 ? (
            <p className="mw-admin-empty" data-testid="outbox-empty">
              No notification has been sent yet.
            </p>
          ) : (
            <ul className="mw-admin-outbox" data-testid="outbox-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <strong>{note.title}</strong>
                  <small>
                    {note.body} · to {note.to.replace("-", " ")} · {relativeTime(note.at)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mw-admin-bento">
        <section className="mw-admin-panel mw-admin-span-5" aria-labelledby="watchlist">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="watchlist">
                <CalendarClock size={16} /> Renewal watchlist
              </h2>
              <p>Dealer plans the “Subscription expiring” trigger watches.</p>
            </div>
          </header>

          <ul className="mw-admin-watchlist" data-testid="watchlist">
            {subs.map((sub) => {
              const left = daysUntil(sub.renewsAt);
              return (
                <li key={sub.id} data-testid={`watch-${sub.id}`}>
                  <div>
                    <strong>{sub.dealer}</strong>
                    <small>
                      {sub.plan} · {sub.seats} seats · {sub.mobile}
                    </small>
                  </div>
                  <span className={`mw-admin-chip is-${left <= 7 ? "danger" : "ok"}`}>
                    {left <= 0 ? "lapsed" : `${left}d`}
                  </span>
                  <button
                    type="button"
                    className="mw-admin-view is-danger"
                    onClick={() => {
                      const result = removeSubscription(actor, sub.id);
                      if (!result.ok) setError(result.error);
                      else refresh(`${sub.dealer} removed from the watchlist.`);
                    }}
                    disabled={!manage}
                    aria-label={`Remove ${sub.dealer}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>

          <form
            className="mw-admin-watch-form"
            data-testid="watch-form"
            onSubmit={(event) => {
              event.preventDefault();
              const result = addSubscription(actor, {
                dealer: subForm.dealer,
                plan: subForm.plan,
                seats: Number(subForm.seats),
                renewsAt: subForm.renewsAt,
                mobile: subForm.mobile,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setSubForm({
                dealer: "",
                plan: "Marketplace Pro",
                seats: "4",
                renewsAt: "",
                mobile: "",
              });
              refresh(`${result.subscription.dealer} is on the watchlist.`);
            }}
          >
            <label className="mw-admin-field">
              <span>Dealer</span>
              <input
                value={subForm.dealer}
                onChange={(event) => setSubForm({ ...subForm, dealer: event.target.value })}
                placeholder="Sharma Motors"
                data-testid="watch-dealer"
                disabled={!manage}
              />
            </label>
            <label className="mw-admin-field">
              <span>Renews on</span>
              <input
                type="date"
                value={subForm.renewsAt}
                onChange={(event) => setSubForm({ ...subForm, renewsAt: event.target.value })}
                data-testid="watch-date"
                disabled={!manage}
              />
            </label>
            <label className="mw-admin-field">
              <span>Seats</span>
              <input
                type="number"
                min={1}
                value={subForm.seats}
                onChange={(event) => setSubForm({ ...subForm, seats: event.target.value })}
                data-testid="watch-seats"
                disabled={!manage}
              />
            </label>
            <button
              type="submit"
              className="mw-admin-view"
              data-testid="watch-add"
              disabled={!manage}
            >
              <Plus size={13} /> Add
            </button>
          </form>
        </section>

        <section className="mw-admin-panel mw-admin-span-7" aria-labelledby="reconcile">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="reconcile">
                <ShieldAlert size={16} /> No-missed-case check
              </h2>
              <p>
                Replays any save that never landed, imports queued leads and frees cases whose owner
                left.
              </p>
            </div>
            <button
              type="button"
              className="mw-admin-view"
              onClick={runCheck}
              data-testid="automation-reconcile-run"
              disabled={!canViewReliability(actor)}
            >
              <RefreshCw size={13} /> Run check
            </button>
          </header>

          <div className="mw-admin-recon-stats" data-testid="recon-stats">
            <span>
              <strong>{report ? report.counts.cases : "—"}</strong>
              <small>cases</small>
            </span>
            <span>
              <strong>{report ? report.counts.leads : "—"}</strong>
              <small>queued leads</small>
            </span>
            <span>
              <strong>{report ? report.counts.journal : "—"}</strong>
              <small>journalled writes</small>
            </span>
            <span>
              <strong>{report ? report.findings.length : "—"}</strong>
              <small>gaps</small>
            </span>
          </div>

          {!report ? (
            <p className="mw-admin-empty">Run the check to audit this device's admin storage.</p>
          ) : report.findings.length === 0 ? (
            <p className="mw-admin-recon-clear" data-testid="recon-clear">
              <CheckCircle2 size={15} /> Every submission reached the tracker
              {report.counts.journal > 0 ? " (all journalled writes completed)" : ""}. Checked{" "}
              {relativeTime(report.at)}.
            </p>
          ) : (
            <ul className="mw-admin-recon-list" data-testid="recon-findings">
              {report.findings.map((finding) => (
                <li key={finding.id} className={`is-${finding.severity}`}>
                  <div>
                    <strong>{finding.title}</strong>
                    <small>{finding.detail}</small>
                  </div>
                  <span className="mw-admin-chip is-ghost">
                    {finding.repairable ? "repairable" : finding.kind.replace("-", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mw-admin-recon-actions">
            {report && report.findings.some((finding) => finding.repairable) ? (
              <button
                type="button"
                className="mw-admin-primary is-small"
                onClick={repair}
                data-testid="automation-reconcile-repair"
              >
                Repair gaps
              </button>
            ) : null}
            <span className="mw-admin-hint">
              Last sweep {state.lastSweepAt ? relativeTime(state.lastSweepAt) : "never"} ·{" "}
              {state.lastSucceeded} succeeded / {state.lastFailed} failed.
            </span>
          </div>
        </section>
      </div>

      {draft ? (
        <div
          className="mw-admin-drawer-root"
          role="dialog"
          aria-modal="true"
          aria-label="Rule builder"
        >
          <button
            type="button"
            className="mw-admin-drawer-backdrop"
            onClick={() => setDraft(null)}
            aria-label="Close rule builder"
          />
          <aside className="mw-admin-drawer is-wide" data-testid="rule-drawer">
            <header className="mw-admin-drawer-head">
              <div>
                <span className="mw-admin-type">
                  {draft.id ? `Editing ${draft.id}` : "New rule"}
                </span>
                <h2>{draft.name || "Untitled rule"}</h2>
                <p>When this happens → if this matches → do this.</p>
              </div>
              <button
                type="button"
                className="mw-admin-drawer-close"
                onClick={() => setDraft(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="mw-admin-drawer-body">
              <div className="mw-admin-drawersection">
                <label className="mw-admin-field is-wide">
                  <span>Rule name</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Finance intake → Ananya"
                    data-testid="rule-name"
                  />
                </label>

                <div className="mw-admin-formgrid">
                  <label className="mw-admin-field is-wide">
                    <span>Trigger</span>
                    <div className="mw-admin-select">
                      <select
                        value={draft.trigger}
                        onChange={(event) => {
                          const trigger = event.target.value as Trigger;
                          setDraft({
                            ...draft,
                            trigger,
                            withinDays: trigger === "subscription.expiring" ? 7 : 1,
                          });
                        }}
                        data-testid="rule-trigger"
                      >
                        {TRIGGERS.map((trigger) => (
                          <option key={trigger} value={trigger}>
                            {TRIGGER_LABEL[trigger]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <small className="mw-admin-hint" data-testid="rule-trigger-hint">
                      {TRIGGER_HINT[draft.trigger]}
                    </small>
                  </label>
                </div>
              </div>

              <div className="mw-admin-drawersection">
                <p className="mw-admin-drawersection-title">Conditions</p>
                <p className="mw-admin-hint">
                  Leave a group empty to match everything the trigger produces
                  {actor.department ? ` on the ${actor.department} desk` : ""}.
                </p>

                <div className="mw-admin-chips" data-testid="rule-types">
                  {deskTypes.map((type) => {
                    const on = draft.types.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`mw-admin-chip ${on ? "is-on" : "is-ghost"}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            types: on
                              ? draft.types.filter((row) => row !== type)
                              : [...draft.types, type],
                          })
                        }
                        data-testid={`rule-type-${type.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>

                <div className="mw-admin-chips">
                  {CASE_PRIORITIES.map((priority) => {
                    const on = draft.priorities.includes(priority);
                    return (
                      <button
                        key={priority}
                        type="button"
                        className={`mw-admin-chip ${on ? "is-on" : "is-ghost"}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            priorities: on
                              ? draft.priorities.filter((row) => row !== priority)
                              : [...draft.priorities, priority],
                          })
                        }
                        data-testid={`rule-priority-${priority.toLowerCase()}`}
                      >
                        {priority}
                      </button>
                    );
                  })}
                </div>

                <label className="mw-admin-check">
                  <input
                    type="checkbox"
                    checked={draft.unassignedOnly}
                    onChange={(event) =>
                      setDraft({ ...draft, unassignedOnly: event.target.checked })
                    }
                    data-testid="rule-unassigned"
                  />
                  <span>Only cases without an owner</span>
                </label>

                {draft.trigger === "followup.due" || draft.trigger === "subscription.expiring" ? (
                  <label className="mw-admin-field">
                    <span>Window (days)</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={draft.withinDays}
                      onChange={(event) =>
                        setDraft({ ...draft, withinDays: Number(event.target.value) })
                      }
                      data-testid="rule-window"
                    />
                  </label>
                ) : null}
              </div>

              <div className="mw-admin-drawersection">
                <p className="mw-admin-drawersection-title">Actions</p>

                <label className="mw-admin-check">
                  <input
                    type="checkbox"
                    checked={draft.assign}
                    onChange={(event) => setDraft({ ...draft, assign: event.target.checked })}
                    data-testid="rule-action-assign"
                  />
                  <span>{ACTION_LABEL.assign}</span>
                </label>
                {draft.assign ? (
                  <div className="mw-admin-formgrid">
                    <label className="mw-admin-field">
                      <span>Assign to</span>
                      <div className="mw-admin-select">
                        <select
                          value={draft.assignTarget}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              assignTarget: event.target.value as "desk-manager" | "employee",
                            })
                          }
                          data-testid="rule-assign-target"
                        >
                          <option value="desk-manager">Manager of the case's desk</option>
                          <option value="employee">A specific employee</option>
                        </select>
                      </div>
                    </label>
                    {draft.assignTarget === "employee" ? (
                      <label className="mw-admin-field">
                        <span>Employee</span>
                        <div className="mw-admin-select">
                          <select
                            value={draft.employeeId}
                            onChange={(event) =>
                              setDraft({ ...draft, employeeId: event.target.value })
                            }
                            data-testid="rule-assign-employee"
                          >
                            <option value="">Choose an employee…</option>
                            {employees
                              .filter((employee) => employee.status === "Active")
                              .map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.name} — {employee.id} · {employee.department}
                                </option>
                              ))}
                          </select>
                        </div>
                      </label>
                    ) : null}
                  </div>
                ) : null}

                <label className="mw-admin-check">
                  <input
                    type="checkbox"
                    checked={draft.notify}
                    onChange={(event) => setDraft({ ...draft, notify: event.target.checked })}
                    data-testid="rule-action-notify"
                  />
                  <span>{ACTION_LABEL.notify}</span>
                </label>
                {draft.notify ? (
                  <label className="mw-admin-field">
                    <span>Notify</span>
                    <div className="mw-admin-select">
                      <select
                        value={draft.notifyTo}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            notifyTo: event.target.value as "admins" | "desk-manager" | "assignee",
                          })
                        }
                        data-testid="rule-notify-to"
                      >
                        <option value="desk-manager">The desk manager</option>
                        <option value="admins">Every admin</option>
                        <option value="assignee">Whoever owns the case</option>
                      </select>
                    </div>
                  </label>
                ) : null}

                <label className="mw-admin-check">
                  <input
                    type="checkbox"
                    checked={draft.priority}
                    onChange={(event) => setDraft({ ...draft, priority: event.target.checked })}
                    data-testid="rule-action-priority"
                  />
                  <span>{ACTION_LABEL.priority}</span>
                </label>
                {draft.priority ? (
                  <label className="mw-admin-field">
                    <span>Priority</span>
                    <div className="mw-admin-select">
                      <select
                        value={draft.priorityValue}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            priorityValue: event.target.value as CasePriority,
                          })
                        }
                        data-testid="rule-priority-value"
                      >
                        {CASE_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                ) : null}

                <label className="mw-admin-check">
                  <input
                    type="checkbox"
                    checked={draft.note}
                    onChange={(event) => setDraft({ ...draft, note: event.target.checked })}
                    data-testid="rule-action-note"
                  />
                  <span>{ACTION_LABEL.note}</span>
                </label>
                {draft.note ? (
                  <label className="mw-admin-field is-wide">
                    <span>Note text</span>
                    <input
                      value={draft.noteText}
                      onChange={(event) => setDraft({ ...draft, noteText: event.target.value })}
                      placeholder="Autopilot: call the customer today."
                      data-testid="rule-note-text"
                    />
                  </label>
                ) : null}
              </div>

              <p className="mw-admin-hint">
                Rules run as <strong>MW Autopilot</strong>. Every action it takes is written to the
                audit log with that name, so a human always owns the decision that created the rule.
              </p>

              {error ? (
                <p className="mw-admin-error" data-testid="rule-error">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="mw-admin-drawer-footer">
              <button
                type="button"
                className="mw-admin-view"
                onClick={() => setDraft(null)}
                data-testid="rule-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="mw-admin-primary is-small"
                onClick={save}
                data-testid="rule-save"
              >
                {draft.id ? "Save changes" : "Create rule"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

/** Kept close to the page so the route file stays about access, not layout. */
export function AutomationLocked() {
  return (
    <div className="mw-admin-empty is-big">
      <Zap size={20} />
      <strong>Autopilot is a management tool</strong>
      <span>Ask an admin to switch on a rule for you.</span>
      <Link to="/master-admin" className="mw-admin-link">
        Back to the dashboard
      </Link>
    </div>
  );
}
