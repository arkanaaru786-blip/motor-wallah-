import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  KeyRound,
  PlusCircle,
  ShieldCheck,
  Store,
  UserCog,
} from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";
import {
  DEALER_CATEGORIES,
  dealerCategoryLabel,
  isDealerCategory,
  type DealerCategoryId,
} from "@/lib/dealer-categories";
import {
  createDealer,
  ensureDealers,
  listDealers,
  rotateDealerPassword,
  setDealerCategory,
  setDealerStatus,
  subscribeToDealers,
  type Dealer,
  type DealerStatus,
} from "@/lib/dealers";
import { dealerLoginId } from "@/lib/partner-ids";
import { shortDate } from "@/lib/dealer-format";
import { IssuedCredentials } from "@/components/admin/IssuedCredentials";

const CHIP: Record<DealerStatus, string> = {
  Active: "is-active",
  Pending: "is-pending",
  Disabled: "is-rejected",
};

const EMPTY_FORM = {
  name: "",
  showroom: "",
  email: "",
  mobile: "",
  city: "",
  category: "cars" as DealerCategoryId,
  password: "",
};

/**
 * Admin control over dealer accounts.
 *
 * This is where the category is bound to a dealer: the dropdown is the only
 * place in the product that can set it, and it is required. The dealer's portal
 * then reads that single value, so a Cars dealer can never be shown Bikes.
 */
export function DealerDirectory({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const mayManage = can(actor, "employee.manage");
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<DealerCategoryId | "all">("all");
  // Plaintext credentials exist only here, once, so the admin can share them.
  const [issued, setIssued] = useState<{
    name: string;
    id: string;
    password: string;
    mobile: string;
  } | null>(null);

  useEffect(() => {
    void ensureDealers().then(() => setDealers(listDealers()));
    return subscribeToDealers(() => setDealers(listDealers()));
  }, []);

  const visible = useMemo(
    () => dealers.filter((dealer) => filter === "all" || dealer.category === filter),
    [dealers, filter],
  );

  const counts = useMemo(
    () => ({
      total: dealers.length,
      active: dealers.filter((dealer) => dealer.status === "Active").length,
      pending: dealers.filter((dealer) => dealer.status === "Pending").length,
    }),
    [dealers],
  );

  return (
    <div className="mw-admin-dash">
      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <Store size={16} />
            </span>
            <span className="mw-admin-kpi-label">Dealers</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.total}</strong>
          <footer>
            <span>{counts.active} active</span>
            <span className="mw-admin-kpi-sub">{counts.pending} awaiting approval</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShieldCheck size={16} />
            </span>
            <span className="mw-admin-kpi-label">Category access</span>
          </header>
          <strong className="mw-admin-kpi-value">
            {new Set(dealers.map((dealer) => dealer.category)).size}
          </strong>
          <footer>
            <span className="mw-admin-kpi-sub">
              Categories currently assigned. A dealer gets exactly one.
            </span>
          </footer>
        </article>
      </section>

      {flash ? (
        <p className="mw-admin-flash" role="status" data-testid="dealer-admin-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-admin-error" role="alert" data-testid="dealer-admin-error">
          {error}
        </p>
      ) : null}

      {issued ? (
        <IssuedCredentials
          kind="dealer"
          name={issued.name}
          id={issued.id}
          password={issued.password}
          mobile={issued.mobile}
          onDismiss={() => setIssued(null)}
        />
      ) : null}

      {mayManage ? (
        <section className="mw-admin-panel">
          <div className="mw-admin-panel-head">
            <div>
              <h2>
                <PlusCircle size={15} /> Create a dealer
              </h2>
              <p>
                Choose the category this dealer may trade in. They see that category only — no
                category picker, no other inventory.
              </p>
            </div>
          </div>
          <form
            className="mw-dealer-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setFlash(null);
              setBusy(true);
              const result = await createDealer({ ...form, status: "Active" });
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setFlash(
                `${result.dealer.showroom} created as ${dealerLoginId(
                  result.dealer,
                )} — ${dealerCategoryLabel(result.dealer.category)} only.`,
              );
              setIssued(
                result.password
                  ? {
                      name: result.dealer.name,
                      id: dealerLoginId(result.dealer),
                      password: result.password,
                      mobile: result.dealer.mobile,
                    }
                  : null,
              );
              setForm(EMPTY_FORM);
              setDealers(listDealers());
            }}
            data-testid="dealer-create-form"
          >
            <label className="mw-dealer-field">
              <span>Dealer name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Imran Shaikh"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Showroom</span>
              <input
                value={form.showroom}
                onChange={(event) => setForm({ ...form, showroom: event.target.value })}
                placeholder="Skyline Cars"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Category (locked to this dealer)</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value as DealerCategoryId })
                }
                data-testid="dealer-create-category"
              >
                {DEALER_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mw-dealer-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="cars@dealer.motorwallah.in"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Mobile</span>
              <input
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                placeholder="9820011201"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>City</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="Mumbai"
                required
              />
            </label>
            <label className="mw-dealer-field">
              <span>Temporary password</span>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Leave blank to auto-generate"
              />
            </label>
            <div className="mw-dealer-form-actions">
              <button type="submit" className="mw-dealer-btn is-primary" disabled={busy}>
                <PlusCircle size={15} /> {busy ? "Creating…" : "Create dealer"}
              </button>
              <span className="mw-dealer-demo-note">
                The partner ID (MW-DLR-…) is assigned automatically. Leave the password blank and
                the panel issues a temporary one, then shows both to share.
              </span>
            </div>
          </form>
        </section>
      ) : (
        <p className="mw-admin-flash" role="status">
          <ShieldCheck size={14} /> Your role can view dealers but not create or change them.
        </p>
      )}

      <section className="mw-admin-panel">
        <div className="mw-admin-panel-head">
          <div>
            <h2>
              <UserCog size={15} /> Dealer accounts
            </h2>
            <p>Approve, disable, or move a dealer to a different category.</p>
          </div>
          <label className="mw-admin-select">
            <span className="sr-only">Filter by category</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as DealerCategoryId | "all")}
              data-testid="dealer-filter-category"
            >
              <option value="all">All categories</option>
              {DEALER_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="mw-admin-empty">No dealers in this category yet.</p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="dealer-admin-table">
              <thead>
                <tr>
                  <th scope="col">Dealer</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Last login</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((dealer) => (
                  <tr key={dealer.id} data-testid={`dealer-admin-row-${dealer.id}`}>
                    <td>
                      <strong>{dealer.showroom}</strong>
                      <div className="is-muted">
                        {dealer.name} · {dealerLoginId(dealer)} · {dealer.city}
                      </div>
                    </td>
                    <td>
                      {mayManage ? (
                        <select
                          value={dealer.category}
                          aria-label={`Category for ${dealer.showroom}`}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (!isDealerCategory(next)) return;
                            const result = setDealerCategory(dealer.id, next);
                            if (!result.ok) setError(result.error);
                            else
                              setFlash(
                                `${dealer.showroom} now sees ${dealerCategoryLabel(next)} only.`,
                              );
                          }}
                          style={{ padding: "4px 8px" }}
                        >
                          {DEALER_CATEGORIES.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{dealerCategoryLabel(dealer.category)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`mw-dealer-chip ${CHIP[dealer.status]}`}>
                        {dealer.status}
                      </span>
                    </td>
                    <td>
                      <div className="is-muted">{dealer.email}</div>
                      <div className="is-muted">{dealer.mobile}</div>
                    </td>
                    <td className="is-muted">
                      {dealer.lastLoginAt ? shortDate(dealer.lastLoginAt) : "Never"}
                    </td>
                    <td>
                      <div className="mw-dealer-actions">
                        {dealer.status !== "Active" ? (
                          <button
                            type="button"
                            className="mw-dealer-btn is-small"
                            disabled={!mayManage}
                            onClick={() => {
                              setDealerStatus(dealer.id, "Active");
                              setFlash(`${dealer.showroom} approved.`);
                            }}
                            data-testid="dealer-approve"
                          >
                            <BadgeCheck size={13} /> Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-danger"
                            disabled={!mayManage}
                            onClick={() => {
                              setDealerStatus(dealer.id, "Disabled");
                              setFlash(
                                `${dealer.showroom} disabled — their session ends on next load.`,
                              );
                            }}
                            data-testid="dealer-disable"
                          >
                            <Ban size={13} /> Disable
                          </button>
                        )}
                        <button
                          type="button"
                          className="mw-dealer-btn is-small"
                          disabled={!mayManage}
                          onClick={async () => {
                            const result = await rotateDealerPassword(dealer.id);
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            setError(null);
                            setFlash(
                              `New temporary password issued for ${dealer.showroom}. Share it privately.`,
                            );
                            setIssued({
                              name: dealer.name,
                              id: dealerLoginId(dealer),
                              password: result.password ?? "",
                              mobile: dealer.mobile,
                            });
                          }}
                          aria-label={`Issue a new temporary password for ${dealer.showroom}`}
                          data-testid="dealer-reset-password"
                        >
                          <KeyRound size={13} /> Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
