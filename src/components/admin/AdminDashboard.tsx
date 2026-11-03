import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeIndianRupee,
  CalendarClock,
  ClipboardList,
  Clock3,
  Layers,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  actionRequired,
  adminKpis,
  employeeName,
  ensureAdminDatabase,
  inr,
  isOpenStatus,
  recentAudit,
  relativeTime,
  slaFor,
  statusBreakdown,
  subscribeToAdminData,
  typeBreakdown,
  visibleAudit,
  visibleCases,
  visibleEmployees,
  type AdminEmployee,
  type CrmCase,
} from "@/lib/admin-crm";
import { ROLE_LABEL, actorFromSession, scopeLabel, type Actor } from "@/lib/admin-rbac";
import type { AdminSession } from "@/lib/admin-auth";
import { AiAssistant } from "./AiAssistant";
import { ReliabilityCard } from "./ReliabilityCard";

const toneForPriority = (priority: CrmCase["priority"]) => `is-${priority.toLowerCase()}`;

export function AdminDashboard({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [tick, setTick] = useState(() => Date.now());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    const unsubscribe = subscribeToAdminData(refresh);
    const timer = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  const data = useMemo(() => {
    void version;
    return ensureAdminDatabase();
  }, [version]);

  /** Only what this person's role may see — every KPI below is scoped. */
  const cases = useMemo(() => visibleCases(actor, data.cases), [actor, data.cases]);
  const employees = useMemo(() => visibleEmployees(actor, data.employees), [actor, data.employees]);

  const kpis = useMemo(() => adminKpis(cases, tick), [cases, tick]);
  const attention = useMemo(() => actionRequired(cases, tick), [cases, tick]);
  const activity = useMemo(
    () => recentAudit(visibleAudit(actor, data.audit), 7),
    [actor, data.audit],
  );
  const mine = useMemo(
    () => cases.filter((item) => item.assignedTo === actor.id && isOpenStatus(item.status)),
    [cases, actor.id],
  );
  const pipeline = useMemo(() => statusBreakdown(cases), [cases]);
  const types = useMemo(() => typeBreakdown(cases), [cases]);
  const maxStatus = Math.max(1, ...pipeline.map((row) => row.count));
  const maxType = Math.max(1, ...types.map((row) => row.count));

  return (
    <div className="mw-admin-dash" data-testid="admin-dashboard">
      <section className="mw-admin-bento" aria-label="Key performance indicators">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <BadgeIndianRupee size={18} />
            </span>
            <span className="mw-admin-kpi-label">Total revenue</span>
          </header>
          <p className="mw-admin-kpi-value" data-testid="kpi-revenue">
            {inr(kpis.revenue)}
          </p>
          <footer>
            <span>{kpis.revenueWon} won cases</span>
            <span className="mw-admin-kpi-sub">Closed-won value in the tracker</span>
          </footer>
        </article>

        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <ClipboardList size={18} />
            </span>
            <span className="mw-admin-kpi-label">Total leads</span>
          </header>
          <p className="mw-admin-kpi-value" data-testid="kpi-leads">
            {kpis.leads}
          </p>
          <footer>
            <span>{kpis.openCases} open</span>
            <span className="mw-admin-kpi-sub">Every business line, one queue</span>
          </footer>
        </article>

        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldAlert size={18} />
            </span>
            <span className="mw-admin-kpi-label">Pending approvals</span>
          </header>
          <p className="mw-admin-kpi-value" data-testid="kpi-approvals">
            {kpis.pendingApprovals}
          </p>
          <footer>
            <span>{kpis.unassigned} unassigned</span>
            <span className="mw-admin-kpi-sub">Needs a manager decision</span>
          </footer>
        </article>

        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Users size={18} />
            </span>
            <span className="mw-admin-kpi-label">Active users</span>
          </header>
          <p className="mw-admin-kpi-value" data-testid="kpi-users">
            {kpis.activeUsers}
          </p>
          <footer>
            <span>{kpis.wonRate}% win rate</span>
            <span className="mw-admin-kpi-sub">Customers active in 30 days</span>
          </footer>
        </article>
      </section>

      <section className="mw-admin-scope is-dash" data-testid="dashboard-scope">
        <span className="mw-admin-scope-icon">
          <ShieldCheck size={15} />
        </span>
        <div>
          <strong>{scopeLabel(actor)}</strong>
          <small>
            {ROLE_LABEL[actor.role]} · every number on this page is limited to what your role can
            see.
          </small>
        </div>
        <Link to="/master-admin/tracker" search={{ scope: "my" }} className="mw-admin-link">
          My tasks ({mine.length}) <ArrowUpRight size={13} />
        </Link>
      </section>

      <div className="mw-admin-bento" data-testid="intelligence-row">
        <AiAssistant session={session} />
        <ReliabilityCard session={session} />
      </div>

      <div className="mw-admin-bento mw-admin-bento--lower">
        <section className="mw-admin-panel mw-admin-span-5" aria-labelledby="action-required">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="action-required">
                <AlertTriangle size={16} /> Action required
              </h2>
              <p>
                Overdue and due-soon cases{" "}
                {actor.role === "super_admin" ? "across every desk" : "on your desk"}.
              </p>
            </div>
            <span className="mw-admin-chip is-danger" data-testid="overdue-count">
              {kpis.overdue} overdue
            </span>
          </header>

          {attention.length === 0 ? (
            <p className="mw-admin-empty">
              Nothing overdue. Every open case is inside its SLA window.
            </p>
          ) : (
            <ul className="mw-admin-actionlist" data-testid="action-list">
              {attention.map((item) => {
                const sla = slaFor(item, tick);
                return (
                  <li key={item.id}>
                    <div className="mw-admin-actionmain">
                      <span className="mw-admin-actiontype">{item.type}</span>
                      <strong>{item.customerName}</strong>
                      <small>
                        {item.id} · {employeeName(data.employees, item.assignedTo) ?? "Unassigned"}
                      </small>
                    </div>
                    <div className="mw-admin-actionside">
                      <span
                        className={`mw-admin-sla is-${sla.state.toLowerCase().replace(" ", "-")}`}
                      >
                        <Clock3 size={12} /> {sla.label}
                      </span>
                      <Link
                        to="/master-admin/tracker"
                        search={{ case: item.id }}
                        className="mw-admin-link"
                      >
                        Open <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mw-admin-panel mw-admin-span-7" aria-labelledby="recent-activity">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="recent-activity">
                <UserCheck size={16} /> Recent activity
              </h2>
              <p>Status changes, assignments and notes from the team.</p>
            </div>
            <Link to="/master-admin/tracker" className="mw-admin-link">
              Master Tracker <ArrowUpRight size={13} />
            </Link>
          </header>

          {activity.length === 0 ? (
            <p className="mw-admin-empty">No activity recorded yet.</p>
          ) : (
            <ol className="mw-admin-activity" data-testid="activity-feed">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span className="mw-admin-activity-avatar" aria-hidden="true">
                    {entry.actorName
                      .split(/\s+/)
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <p>
                      <strong>{entry.actorName}</strong> {entry.summary}
                    </p>
                    <small>
                      {ROLE_LABEL[entry.actorRole]} ·{" "}
                      {entry.department ? `${entry.department} · ` : ""}
                      {relativeTime(entry.at, tick)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mw-admin-panel mw-admin-span-4" aria-labelledby="pipeline">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="pipeline">
                <Layers size={16} /> Pipeline
              </h2>
              <p>Every case by current status.</p>
            </div>
          </header>
          <ul className="mw-admin-bars">
            {pipeline.map((row) => (
              <li key={row.status}>
                <span>{row.status}</span>
                <span className="mw-admin-bar">
                  <em
                    className={isOpenStatus(row.status) ? "is-open" : "is-closed"}
                    style={{ width: `${Math.max(6, (row.count / maxStatus) * 100)}%` }}
                  />
                </span>
                <b>{row.count}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="mw-admin-panel mw-admin-span-8" aria-labelledby="by-type">
          <header className="mw-admin-panel-head">
            <div>
              <h2 id="by-type">
                <CalendarClock size={16} /> Cases by business line
              </h2>
              <p>Where demand is coming from on your desk, {session.name.split(" ")[0]}.</p>
            </div>
          </header>
          <ul className="mw-admin-types" data-testid="type-breakdown">
            {types.map((row) => (
              <li key={row.type}>
                <span className="mw-admin-typetop">
                  <strong>{row.type}</strong>
                  <em>{row.count}</em>
                </span>
                <span className="mw-admin-bar">
                  <em className="is-open" style={{ width: `${(row.open / maxType) * 100}%` }} />
                </span>
                <small>{row.open} open</small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <EmployeesStrip employees={employees} cases={cases} tick={tick} />
    </div>
  );
}

function EmployeesStrip({
  employees,
  cases,
  tick,
}: {
  employees: AdminEmployee[];
  cases: CrmCase[];
  tick: number;
}) {
  return (
    <section className="mw-admin-panel mw-admin-team" aria-labelledby="team-load">
      <header className="mw-admin-panel-head">
        <div>
          <h2 id="team-load">
            <Users size={16} /> Desk load
          </h2>
          <p>Open cases currently sitting with each teammate.</p>
        </div>
      </header>
      <ul>
        {employees.map((employee) => {
          const open = cases.filter(
            (item) => item.assignedTo === employee.id && isOpenStatus(item.status),
          );
          const overdue = open.filter((item) => slaFor(item, tick).state === "Overdue").length;
          return (
            <li key={employee.id}>
              <span className={`mw-admin-priority ${toneForPriority(overdue ? "High" : "Low")}`}>
                {employee.name
                  .split(" ")
                  .map((part) => part.charAt(0))
                  .join("")}
              </span>
              <div>
                <strong>{employee.name}</strong>
                <small>
                  {employee.department} · {ROLE_LABEL[employee.role]}
                </small>
              </div>
              <span className={overdue ? "mw-admin-team-overdue" : "mw-admin-team-ok"}>
                {open.length} open
                {overdue ? ` · ${overdue} late` : ""}
              </span>
            </li>
          );
        })}
        <li className="is-unassigned">
          <span className="mw-admin-priority">?</span>
          <div>
            <strong>Unassigned</strong>
            <small>Needs an owner</small>
          </div>
          <span className="mw-admin-team-overdue">
            {cases.filter((item) => !item.assignedTo && isOpenStatus(item.status)).length} open
          </span>
        </li>
      </ul>
    </section>
  );
}
