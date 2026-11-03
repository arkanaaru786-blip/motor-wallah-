import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import {
  autopilotState,
  listNotifications,
  notificationsFor,
  listRules,
  maybeSweep,
  visibleRules,
} from "@/lib/admin-automation";
import { criticalCount, inspect, lastReport, repairFindings } from "@/lib/admin-reconcile";
import { listRuns } from "@/lib/admin-automation";
import { actorFromSession, canManageAutomation, canViewReliability } from "@/lib/admin-rbac";
import { relativeTime } from "@/lib/admin-crm";
import type { AdminSession } from "@/lib/admin-auth";
import { useEffect } from "react";

/**
 * Two live health signals for the control room: what the autopilot just did,
 * and whether every submission actually reached the tracker.
 */
export function ReliabilityCard({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const report = useMemo(() => lastReport(), [version]);
  const state = useMemo(() => autopilotState(), [version]);
  const rules = useMemo(() => visibleRules(actor, listRules()), [actor, version]);
  const runs = useMemo(() => listRuns().slice(0, 1), [version]);
  const unread = useMemo(
    () => notificationsFor(actor, listNotifications()).filter((item) => !item.read).length,
    [actor, version],
  );

  useEffect(() => {
    if (canManageAutomation(actor)) maybeSweep(actor);
    if (canViewReliability(actor)) inspect(actor, { audit: false });
    setVersion((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCheck = canViewReliability(actor);
  const active = rules.filter((rule) => rule.enabled).length;
  const gaps = criticalCount(report);

  const runCheck = () => {
    const fresh = inspect(actor);
    setVersion((value) => value + 1);
    setNote(
      fresh.findings.length === 0
        ? "All clear — every submission reached the tracker."
        : `${fresh.findings.length} gap${fresh.findings.length === 1 ? "" : "s"} found.`,
    );
  };

  const repair = () => {
    const result = repairFindings(actor, report);
    setVersion((value) => value + 1);
    setNote(
      result.ok
        ? (result.result.messages[0] ?? `Repaired ${result.result.repaired} item(s).`)
        : result.error,
    );
  };

  return (
    <section
      className="mw-admin-panel mw-admin-span-5 mw-admin-reliability"
      data-testid="reliability-card"
    >
      <header className="mw-admin-panel-head">
        <div>
          <h2>
            <Zap size={16} /> Autopilot &amp; reliability
          </h2>
          <p>Rules that run themselves, and a check that nothing got lost.</p>
        </div>
        <Link to="/master-admin/automation" className="mw-admin-link">
          Manage <ArrowUpRight size={13} />
        </Link>
      </header>

      <div className="mw-admin-reliability-grid">
        <article className="mw-admin-reliability-tile">
          <span className="mw-admin-reliability-label">Active rules</span>
          <strong data-testid="autopilot-active">{active}</strong>
          <small>
            {state.lastSweepAt ? `last sweep ${relativeTime(state.lastSweepAt)}` : "no sweep yet"}
          </small>
        </article>
        <article className="mw-admin-reliability-tile">
          <span className="mw-admin-reliability-label">Last sweep</span>
          <strong data-testid="autopilot-last-run">
            {state.lastFired} action{state.lastFired === 1 ? "" : "s"}
          </strong>
          <small>
            {state.lastSucceeded} ok · {state.lastFailed} failed · {unread} notification
            {unread === 1 ? "" : "s"} waiting
          </small>
        </article>
        <article
          className={`mw-admin-reliability-tile is-${gaps > 0 ? "danger" : "ok"}`}
          data-testid="reliability-status"
        >
          <span className="mw-admin-reliability-label">Missed cases</span>
          <strong>{report ? report.findings.length : "—"}</strong>
          <small>
            {report ? `checked ${relativeTime(report.at)}` : "not checked on this device yet"}
          </small>
        </article>
      </div>

      {runs[0] ? (
        <p className="mw-admin-reliability-last" data-testid="autopilot-last-entry">
          <span className={`mw-admin-chip is-${runs[0].outcome === "success" ? "ok" : "danger"}`}>
            {runs[0].outcome === "success" ? "Success" : "Failure"}
          </span>
          <strong>{runs[0].ruleName}</strong> · {runs[0].target} — {runs[0].detail}
        </p>
      ) : (
        <p className="mw-admin-reliability-last">
          Rules fire when the panel opens. Nothing has run yet.
        </p>
      )}

      {report && report.findings.length > 0 ? (
        <ul className="mw-admin-reliability-findings" data-testid="reliability-findings">
          {report.findings.slice(0, 3).map((finding) => (
            <li key={finding.id} className={`is-${finding.severity}`}>
              <ShieldAlert size={14} />
              <span>
                <strong>{finding.title}</strong>
                <small>{finding.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mw-admin-reliability-clear">
          <CheckCircle2 size={15} /> Nothing lost — every write this device attempted landed in the
          tracker.
        </p>
      )}

      {canCheck ? (
        <div className="mw-admin-reliability-actions">
          <button
            type="button"
            className="mw-admin-view"
            onClick={runCheck}
            data-testid="reconcile-run"
          >
            <RefreshCw size={13} /> Run check
          </button>
          {report && report.findings.some((finding) => finding.repairable) ? (
            <button
              type="button"
              className="mw-admin-primary is-small"
              onClick={repair}
              data-testid="reconcile-repair"
            >
              Repair now
            </button>
          ) : null}
          {note ? <span className="mw-admin-reliability-note">{note}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
