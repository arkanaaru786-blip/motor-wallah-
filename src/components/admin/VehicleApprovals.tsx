import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import {
  APPROVALS_SETUP_HINT,
  approvalDate,
  approvalPrice,
  decideApproval,
  loadApprovals,
  type ApprovalStatus,
  type VehicleApproval,
} from "@/lib/vehicle-approvals";

type Filter = "All" | ApprovalStatus;

const CHIP: Record<ApprovalStatus, string> = {
  Pending: "is-pending",
  Approved: "is-active",
  Rejected: "is-rejected",
};

/**
 * Vehicle Approvals — dealer listings that are waiting for review.
 *
 * A dealer's new vehicle is submitted to `vehicle_approvals` as Pending. An
 * approval makes it readable by the public site (the BUY catalogue merges
 * approved rows); a rejection keeps it off the site and records the reason.
 */
export function VehicleApprovalsPanel({ session }: { session: AdminSession }) {
  const allowed = isSuperAdmin(actorFromSession(session));

  const [approvals, setApprovals] = useState<VehicleApproval[]>([]);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const result = await loadApprovals();
    setApprovals(result.approvals);
    setMissing(result.missing);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: approvals.filter((row) => row.status === "Pending").length,
      approved: approvals.filter((row) => row.status === "Approved").length,
      rejected: approvals.filter((row) => row.status === "Rejected").length,
    }),
    [approvals],
  );

  const visible = useMemo(
    () => approvals.filter((row) => filter === "All" || row.status === filter),
    [approvals, filter],
  );

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="approvals-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Listings</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">Only a super admin can publish or reject dealer listings.</p>
      </section>
    );
  }

  async function decide(row: VehicleApproval, status: "Approved" | "Rejected", note = "") {
    setBusyId(row.id);
    setFlash(null);
    setError(null);
    const result = await decideApproval(row.id, status, note);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update this listing.");
      return;
    }
    setApprovals((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status,
              rejectionReason: status === "Rejected" ? note.trim() : "",
              decidedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setRejectingId(null);
    setReason("");
    setFlash(
      status === "Approved"
        ? `${row.vehicleName} approved — it is live on the BUY marketplace now.`
        : `${row.vehicleName} rejected. The dealer sees the reason.`,
    );
  }

  return (
    <div className="mw-admin-dash" data-testid="approvals-page">
      <div className="mw-dealer-pagehead">
        <div>
          <p className="mw-admin-eyebrow">Listings</p>
          <h2>Vehicle Approvals</h2>
          <p>Dealer submissions wait here until you approve them for the public marketplace.</p>
        </div>
        <button
          type="button"
          className="mw-dealer-btn"
          onClick={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          data-testid="approvals-refresh"
        >
          <RefreshCw size={14} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldCheck size={16} />
            </span>
            <span className="mw-admin-kpi-label">Pending review</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.pending}</strong>
          <footer>
            <span>Nothing goes live before approval</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <BadgeCheck size={16} />
            </span>
            <span className="mw-admin-kpi-label">Approved</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.approved}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Live on the BUY marketplace.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <X size={16} />
            </span>
            <span className="mw-admin-kpi-label">Rejected</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.rejected}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Kept off the site with a reason.</span>
          </footer>
        </article>
      </section>

      {missing ? (
        <p className="mw-admin-error" data-testid="approvals-setup">
          {APPROVALS_SETUP_HINT}
        </p>
      ) : null}
      {error && !missing ? (
        <p className="mw-admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="mw-admin-flash" role="status">
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}

      <section className="mw-admin-panel">
        <div className="mw-admin-panel-head">
          <div>
            <h2>
              <ShieldCheck size={15} /> Dealer submissions
            </h2>
            <p>
              {counts.pending} waiting · {counts.approved} approved · {counts.rejected} rejected
            </p>
          </div>
          <label className="mw-admin-select">
            <span className="sr-only">Filter by approval status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              data-testid="approvals-filter"
            >
              <option value="All">All submissions</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="mw-admin-hint" aria-busy="true">
            <Loader2 size={14} /> Loading submissions…
          </p>
        ) : visible.length === 0 ? (
          <p className="mw-admin-empty" data-testid="approvals-empty">
            No {filter === "All" ? "" : `${filter.toLowerCase()} `}dealer listings. New dealer
            submissions appear here.
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="approvals-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Dealer</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} data-testid={`approval-row-${row.id}`}>
                    <td>
                      <strong>{row.vehicleName}</strong>
                      <div className="is-muted">
                        {row.year} · {row.km.toLocaleString("en-IN")} km · {row.fuel}
                      </div>
                      <div className="is-muted">{approvalDate(row.createdAt)}</div>
                    </td>
                    <td>
                      <strong>{row.dealerName || row.dealerId}</strong>
                      <div className="is-muted">{row.dealerId}</div>
                    </td>
                    <td>{row.category}</td>
                    <td>{approvalPrice(row.price)}</td>
                    <td>
                      <span className={`mw-dealer-chip ${CHIP[row.status]}`}>{row.status}</span>
                      {row.status === "Rejected" && row.rejectionReason ? (
                        <div className="is-muted">{row.rejectionReason}</div>
                      ) : null}
                    </td>
                    <td>
                      {row.status === "Pending" ? (
                        <div className="mw-dealer-actions">
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-primary"
                            disabled={busyId === row.id}
                            onClick={() => void decide(row, "Approved")}
                            data-testid={`approve-${row.id}`}
                          >
                            <BadgeCheck size={12} /> {busyId === row.id ? "Saving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-danger"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setRejectingId(row.id);
                              setReason("");
                            }}
                            data-testid={`reject-${row.id}`}
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="is-muted">{approvalDate(row.decidedAt)}</span>
                      )}
                      {rejectingId === row.id ? (
                        <div className="mw-approval-reject">
                          <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Reason shown to the dealer (optional)"
                            aria-label="Rejection reason"
                            data-testid={`reject-reason-${row.id}`}
                          />
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-danger"
                            onClick={() => void decide(row, "Rejected", reason)}
                          >
                            Confirm reject
                          </button>
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-quiet"
                            onClick={() => setRejectingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          Dealer listings are submitted automatically when a dealer adds a vehicle. Run{" "}
          <code>supabase/admin-features.sql</code> to create the approval queue.
        </p>
      </section>
    </div>
  );
}
