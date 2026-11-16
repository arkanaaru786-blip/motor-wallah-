import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import { BUY_CATEGORY_LIST, type BuyCategoryId } from "@/lib/buy-catalog";
import {
  APPROVALS_SETUP_HINT,
  approvalDate,
  approvalPrice,
  createAdminVehicle,
  decideApproval,
  loadApprovals,
  type AdminVehicleInput,
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
  const [formOpen, setFormOpen] = useState(false);

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
        <div className="mw-admin-inline">
          <button
            type="button"
            className="mw-dealer-btn is-primary"
            onClick={() => setFormOpen((open) => !open)}
            data-testid="add-vehicle-open"
          >
            <PlusCircle size={15} /> Add New Vehicle
          </button>
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
      </div>

      {formOpen ? (
        <AdminVehicleForm
          onClose={() => setFormOpen(false)}
          onSaved={(featured) => {
            setFormOpen(false);
            setFlash(
              featured
                ? "Vehicle published as Featured — it sits at the top of its BUY category."
                : "Vehicle published to the BUY marketplace.",
            );
            void load();
          }}
        />
      ) : null}

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
                      {row.featured ? (
                        <span className="mw-dealer-chip is-featured">
                          <Star size={10} /> Featured
                        </span>
                      ) : null}
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

/**
 * Master-admin listing form.
 *
 * Saves straight to the shared vehicle table as Approved (the admin is the
 * reviewer), with an optional Featured flag that raises it above normal BUY
 * inventory. Photo URLs are optional; without them the category photograph is
 * used on the public card.
 */
function AdminVehicleForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (featured: boolean) => void;
}) {
  const [category, setCategory] = useState<BuyCategoryId>("cars");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("2022");
  const [price, setPrice] = useState("");
  const [km, setKm] = useState("");
  const [fuel, setFuel] = useState("Petrol");
  const [city, setCity] = useState("Indore");
  const [photos, setPhotos] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const numericYear = Number(year);
    const numericPrice = Number(price);
    const numericKm = Number(km);
    if (brand.trim().length < 2 || model.trim().length < 1) {
      setError("Enter the brand and model.");
      return;
    }
    if (!Number.isFinite(numericYear) || numericYear < 1990 || numericYear > 2026) {
      setError("Enter a year between 1990 and 2026.");
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Enter an asking price greater than zero.");
      return;
    }
    if (!Number.isFinite(numericKm) || numericKm < 0) {
      setError("Enter the kilometres driven.");
      return;
    }

    const input: AdminVehicleInput = {
      category,
      brand,
      model,
      year: numericYear,
      price: numericPrice,
      km: numericKm,
      fuel,
      city,
      description,
      photos: photos.split(/[\n,]+/),
      featured,
    };

    setBusy(true);
    setError(null);
    const result = await createAdminVehicle(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save this vehicle.");
      return;
    }
    onSaved(featured);
  }

  return (
    <section className="mw-admin-panel" data-testid="admin-vehicle-form">
      <div className="mw-admin-panel-head">
        <div>
          <h2>
            <PlusCircle size={15} /> Add new vehicle
          </h2>
          <p>
            Published straight to the BUY marketplace. Tick Featured to place it at the top of its
            category with a Featured badge.
          </p>
        </div>
        <button type="button" className="mw-dealer-btn is-quiet" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>

      <form className="mw-dealer-form" onSubmit={submit}>
        <label className="mw-dealer-field">
          <span>Vehicle category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as BuyCategoryId)}
            data-testid="admin-vehicle-category"
          >
            {BUY_CATEGORY_LIST.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mw-dealer-field">
          <span>Brand</span>
          <input
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Maruti Suzuki"
            required
            data-testid="admin-vehicle-brand"
          />
        </label>
        <label className="mw-dealer-field">
          <span>Model</span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Baleno Zeta"
            required
            data-testid="admin-vehicle-model"
          />
        </label>
        <label className="mw-dealer-field">
          <span>Year</span>
          <input
            type="number"
            min={1990}
            max={2026}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            required
            data-testid="admin-vehicle-year"
          />
        </label>
        <label className="mw-dealer-field">
          <span>Price (₹)</span>
          <input
            type="number"
            min={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="725000"
            required
            data-testid="admin-vehicle-price"
          />
        </label>
        <label className="mw-dealer-field">
          <span>Kilometres driven</span>
          <input
            type="number"
            min={0}
            value={km}
            onChange={(event) => setKm(event.target.value)}
            placeholder="32000"
            required
            data-testid="admin-vehicle-km"
          />
        </label>
        <label className="mw-dealer-field">
          <span>Fuel</span>
          <select
            value={fuel}
            onChange={(event) => setFuel(event.target.value)}
            data-testid="admin-vehicle-fuel"
          >
            <option>Petrol</option>
            <option>Diesel</option>
            <option>CNG</option>
            <option>Hybrid</option>
            <option>EV</option>
          </select>
        </label>
        <label className="mw-dealer-field">
          <span>Location</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Indore"
            required
            data-testid="admin-vehicle-city"
          />
        </label>
        <label className="mw-dealer-field is-span-3">
          <span>Photos (one image URL per line, optional)</span>
          <textarea
            value={photos}
            onChange={(event) => setPhotos(event.target.value)}
            rows={2}
            placeholder="https://…/front.jpg"
            data-testid="admin-vehicle-photos"
          />
        </label>
        <label className="mw-dealer-field is-span-3">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Condition, ownership, service history and anything a buyer should know."
            data-testid="admin-vehicle-description"
          />
        </label>

        <label className="mw-vehicle-feature is-span-3">
          <input
            type="checkbox"
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
            data-testid="admin-vehicle-featured"
          />
          <span>
            <strong>
              <Star size={13} /> Feature this vehicle (Show at top)
            </strong>
            <small>
              Featured listings appear first in their BUY category and carry a Featured badge on the
              card.
            </small>
          </span>
        </label>

        {error ? (
          <p className="mw-admin-error is-span-3" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mw-dealer-form-actions is-span-3">
          <button
            type="submit"
            className="mw-dealer-btn is-primary"
            disabled={busy}
            data-testid="admin-vehicle-save"
          >
            {busy ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}{" "}
            {busy ? "Publishing…" : featured ? "Publish as Featured" : "Publish Vehicle"}
          </button>
          <button type="button" className="mw-dealer-btn is-quiet" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
