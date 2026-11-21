import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, Phone, RefreshCw, Users } from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import {
  CUSTOMERS_SETUP_HINT,
  customerMobileLabel,
  customerTelHref,
  loadCustomers,
  type CustomerDirectoryResult,
  type CustomerRow,
} from "@/lib/admin-customers";
import { shortDate } from "@/lib/dealer-format";

/**
 * Customers — every registered customer account.
 *
 * The table intentionally shows exactly the five fields the business manages
 * from: Name, Mobile, Email, City and Registration Date. Data comes from
 * `loadCustomers()`, which unions the Supabase copies with the on-device one.
 */
export function CustomerDirectory({ session }: { session: AdminSession }) {
  const actor = actorFromSession(session);
  const allowed = isSuperAdmin(actor);

  const [data, setData] = useState<CustomerDirectoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadCustomers();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  const rows = data?.rows ?? [];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.mobile, row.email, row.city].join(" ").toLowerCase().includes(needle),
    );
  }, [rows, query]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      withMobile: rows.filter((row) => row.mobile).length,
      withEmail: rows.filter((row) => row.email).length,
    }),
    [rows],
  );

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="customers-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Customers</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">
          The customer list contains phone numbers and email addresses, so only a super admin can
          read it.
        </p>
      </section>
    );
  }

  const cell = (row: CustomerRow, key: "name" | "email" | "city") => row[key] || "—";

  return (
    <div className="mw-admin-dash" data-testid="customers-page">
      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <Users size={16} />
            </span>
            <span className="mw-admin-kpi-label">Registered customers</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.total}</strong>
          <footer>
            <span>{counts.withMobile} with a mobile number on file</span>
            <span className="mw-admin-kpi-sub">
              Every account created on the site, newest registration first.
            </span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Mail size={16} />
            </span>
            <span className="mw-admin-kpi-label">Email on file</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.withEmail}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Reachable by email campaigns and receipts.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Phone size={16} />
            </span>
            <span className="mw-admin-kpi-label">Callable today</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.withMobile}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Tap a number in the table to call the customer.</span>
          </footer>
        </article>
      </section>

      {data?.missing ? (
        <p className="mw-admin-error" data-testid="customers-setup">
          {CUSTOMERS_SETUP_HINT}
        </p>
      ) : null}
      {data?.error ? (
        <p className="mw-admin-error" role="alert">
          {data.error}
        </p>
      ) : null}
      {flash ? (
        <p className="mw-admin-flash" role="status">
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}

      <section className="mw-admin-panel">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Customer accounts</p>
            <h2>
              <Users size={15} /> Customers
            </h2>
            <p>
              Name, mobile, email, city and registration date for every registered customer — the
              desk view for follow-ups and support.
            </p>
          </div>
          <div className="mw-admin-inline">
            <button
              type="button"
              className="mw-admin-ghost"
              onClick={() => {
                setRefreshing(true);
                setFlash(null);
                void load()
                  .then(() => setFlash("Customer list refreshed."))
                  .finally(() => setRefreshing(false));
              }}
              data-testid="customers-refresh"
            >
              {refreshing ? <Loader2 size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </header>

        <div className="mw-admin-formgrid">
          <label className="mw-admin-field">
            <span>Search customers</span>
            <input
              className="mw-admin-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, mobile, email or city"
              data-testid="customers-search"
            />
          </label>
        </div>

        {loading ? (
          <p className="mw-admin-hint" aria-busy="true">
            <Loader2 size={14} /> Loading customers…
          </p>
        ) : visible.length === 0 ? (
          <p className="mw-admin-empty" data-testid="customers-empty">
            {rows.length === 0
              ? "No registered customers yet. Accounts appear here as soon as someone creates one on the site."
              : "No customers match this search."}
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="customers-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Email</th>
                  <th scope="col">City</th>
                  <th scope="col">Registration Date</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const tel = customerTelHref(row.mobile);
                  return (
                    <tr key={row.id} data-testid={`customer-row-${row.id}`}>
                      <td>
                        <strong>{cell(row, "name")}</strong>
                      </td>
                      <td>
                        {tel ? <a href={tel}>{customerMobileLabel(row.mobile)}</a> : "—"}
                      </td>
                      <td>
                        {row.email ? <a href={`mailto:${row.email}`}>{row.email}</a> : "—"}
                      </td>
                      <td>{cell(row, "city")}</td>
                      <td className="is-muted">{row.createdAt ? shortDate(row.createdAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          Showing {visible.length} of {rows.length} customer{rows.length === 1 ? "" : "s"} ·{" "}
          {data ? `${data.sources.records} from the live collection` : "reading…"}
          {data ? `, ${data.sources.profilesTable} from the profiles table` : ""}
          {data && data.sources.local ? `, ${data.sources.local} from this device` : ""}.
        </p>
      </section>
    </div>
  );
}
