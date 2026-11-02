import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, ScrollText, Search, ShieldCheck } from "lucide-react";
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORY,
  ensureAdminDatabase,
  relativeTime,
  subscribeToAdminData,
  visibleAudit,
  type AuditAction,
} from "@/lib/admin-crm";
import { ROLE_LABEL, actorFromSession, scopeLabel } from "@/lib/admin-rbac";
import type { AdminSession } from "@/lib/admin-auth";

const PAGE_SIZE = 20;

export function AuditLog({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AuditAction | "all">("all");
  const [outcome, setOutcome] = useState<"all" | "allowed" | "denied">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    return subscribeToAdminData(refresh);
  }, []);

  const data = useMemo(() => {
    void version;
    return ensureAdminDatabase();
  }, [version]);

  const entries = useMemo(() => visibleAudit(actor, data.audit), [actor, data.audit]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => category === "all" || entry.action === category)
      .filter((entry) => outcome === "all" || entry.outcome === outcome)
      .filter((entry) =>
        needle
          ? [entry.actorName, entry.target, entry.summary, entry.department ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [entries, category, outcome, query]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="mw-admin-audit" data-testid="audit-log">
      <section className="mw-admin-scope" data-testid="audit-scope">
        <span className="mw-admin-scope-icon">
          <ShieldCheck size={15} />
        </span>
        <div>
          <strong>{scopeLabel(actor)}</strong>
          <small>
            {ROLE_LABEL[actor.role]} · every refused attempt is logged too, so hiding a button never
            hides the attempt.
          </small>
        </div>
        <span className="mw-admin-chip" data-testid="audit-total-chip">
          {total} entries
        </span>
      </section>

      <section className="mw-admin-toolbar" aria-label="Audit filters">
        <div className="mw-admin-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search person, case ID, detail…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            aria-label="Search audit entries"
            data-testid="audit-search"
          />
        </div>
        <div className="mw-admin-quickfilters">
          <label className="mw-admin-select">
            <span className="sr-only">Action</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as AuditAction | "all");
                setPage(1);
              }}
              data-testid="audit-category"
            >
              <option value="all">All actions</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {AUDIT_CATEGORY[action]}
                </option>
              ))}
            </select>
          </label>
          <label className="mw-admin-select">
            <span className="sr-only">Outcome</span>
            <select
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as "all" | "allowed" | "denied");
                setPage(1);
              }}
              data-testid="audit-outcome"
            >
              <option value="all">Any outcome</option>
              <option value="allowed">Allowed</option>
              <option value="denied">Refused</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mw-admin-tablewrap" aria-label="Audit entries">
        <table className="mw-admin-table mw-admin-table--audit" data-testid="audit-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Details</th>
              <th scope="col">Target</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} data-testid={`audit-row-${entry.id}`}>
                <td data-label="When">
                  <span className="mw-admin-when">{relativeTime(entry.at)}</span>
                </td>
                <td data-label="Who">
                  <span className="mw-admin-customer">{entry.actorName}</span>
                  <small className="mw-admin-vehicle">
                    {ROLE_LABEL[entry.actorRole]} · {entry.actorId}
                  </small>
                </td>
                <td data-label="Action">
                  <span className={`mw-admin-role is-${entry.action.replace(/\./g, "-")}`}>
                    {AUDIT_CATEGORY[entry.action]}
                  </span>
                </td>
                <td data-label="Details">
                  <span className="mw-admin-audittext">{entry.summary}</span>
                  {entry.department ? (
                    <small className="mw-admin-vehicle">{entry.department} desk</small>
                  ) : null}
                </td>
                <td data-label="Target">
                  <strong className="mw-admin-caseid">{entry.target}</strong>
                </td>
                <td data-label="Outcome">
                  <span className={`mw-admin-empstatus is-${entry.outcome}`}>
                    {entry.outcome === "allowed" ? "Allowed" : "Refused"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="mw-admin-empty is-big" data-testid="audit-empty">
            <Lock size={18} /> Nothing recorded for this filter yet.
          </div>
        ) : null}
      </section>

      <nav className="mw-admin-pagination" aria-label="Audit pagination">
        <span data-testid="audit-range">
          {total === 0
            ? "No entries"
            : `Showing ${start + 1}–${start + rows.length} of ${total} entries`}
        </span>
        <div className="mw-admin-pagination-controls">
          <button
            type="button"
            className="mw-admin-page"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="mw-admin-pagecount">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            className="mw-admin-page"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      <p className="mw-admin-hint is-foot">
        <ScrollText size={13} /> The log keeps the last 500 actions on this device: status changes,
        assignments, notes, employee edits, password resets, sign-ins and refused attempts.
      </p>
    </div>
  );
}
