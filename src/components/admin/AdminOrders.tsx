import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Package, RefreshCw, ShoppingBag } from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";
import {
  ORDERS_SETUP_HINT,
  ORDER_STATUSES,
  loadAdminOrders,
  orderDate,
  orderItemSummary,
  orderStatusLabel,
  orderTotal,
  setOrderStatus,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin-orders";

type Filter = "all" | OrderStatus;

/**
 * Orders — every parts and decor order, with payment and fulfilment status.
 *
 * Rows are read through the staff Supabase session (RLS in
 * supabase/admin-features.sql); changing the dropdown updates the same order
 * row the customer sees in My Orders.
 */
export function AdminOrdersPanel({ session }: { session: AdminSession }) {
  const allowed = can(actorFromSession(session), "reports.view");

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadAdminOrders();
    setOrders(result.orders);
    setMissing(result.missing);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((order) => order.status === "pending").length,
      shipped: orders.filter((order) => order.status === "shipped").length,
      revenue: orders
        .filter((order) => order.status !== "cancelled")
        .reduce((total, order) => total + order.totalAmount, 0),
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      if (!needle) return true;
      return [order.orderRef, order.customerName, order.mobile, order.city, orderItemSummary(order)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [orders, filter, query]);

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="orders-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Orders</p>
            <h2>Restricted</h2>
          </div>
        </header>
        <p className="mw-admin-hint">Your role cannot read customer orders.</p>
      </section>
    );
  }

  async function changeStatus(order: AdminOrder, status: OrderStatus) {
    setUpdating(order.id);
    setFlash(null);
    const result = await setOrderStatus(order.id, status);
    setUpdating(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update this order.");
      return;
    }
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status } : item)),
    );
    setFlash(`${order.orderRef} marked ${orderStatusLabel(status).toLowerCase()}.`);
  }

  return (
    <div className="mw-admin-dash" data-testid="orders-page">
      <section className="mw-admin-bento">
        <article className="mw-admin-kpi is-hero">
          <header>
            <span className="mw-admin-kpi-icon">
              <ShoppingBag size={16} />
            </span>
            <span className="mw-admin-kpi-label">Orders</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.total}</strong>
          <footer>
            <span>{counts.pending} pending</span>
            <span className="mw-admin-kpi-sub">Auto parts and decor together.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <Package size={16} />
            </span>
            <span className="mw-admin-kpi-label">Shipped</span>
          </header>
          <strong className="mw-admin-kpi-value">{counts.shipped}</strong>
          <footer>
            <span className="mw-admin-kpi-sub">Awaiting delivery confirmation.</span>
          </footer>
        </article>
        <article className="mw-admin-kpi">
          <header>
            <span className="mw-admin-kpi-icon">
              <CheckCircle2 size={16} />
            </span>
            <span className="mw-admin-kpi-label">Order value</span>
          </header>
          <strong className="mw-admin-kpi-value">
            ₹{Math.round(counts.revenue).toLocaleString("en-IN")}
          </strong>
          <footer>
            <span className="mw-admin-kpi-sub">Excludes cancelled orders.</span>
          </footer>
        </article>
      </section>

      {missing ? (
        <p className="mw-admin-error" data-testid="orders-setup">
          {ORDERS_SETUP_HINT}
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
              <ShoppingBag size={15} /> Parts &amp; Decor Orders
            </h2>
            <p>Track payment and move each order from pending to delivered.</p>
          </div>
          <div className="mw-admin-inline">
            <label className="mw-admin-select">
              <span className="sr-only">Filter by fulfilment status</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                data-testid="orders-filter"
              >
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="mw-admin-ghost"
              onClick={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
              data-testid="orders-refresh"
            >
              {refreshing ? <Loader2 size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </div>

        <div className="mw-admin-formgrid">
          <label className="mw-admin-field">
            <span>Search orders</span>
            <input
              className="mw-admin-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Order id, customer, mobile or item"
              data-testid="orders-search"
            />
          </label>
        </div>

        {loading ? (
          <p className="mw-admin-hint" aria-busy="true">
            <Loader2 size={14} /> Loading orders…
          </p>
        ) : visible.length === 0 ? (
          <p className="mw-admin-empty" data-testid="orders-empty">
            No orders match this view yet. New parts and decor checkouts appear here automatically.
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id} data-testid={`order-row-${order.id}`}>
                    <td>
                      <strong>{order.orderRef}</strong>
                      <div className="is-muted">
                        {order.itemType === "decor" ? "Decor" : "Auto parts"} ·{" "}
                        {orderDate(order.createdAt)}
                      </div>
                    </td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <div className="is-muted">
                        {order.mobile || "—"}
                        {order.city ? ` · ${order.city}` : ""}
                      </div>
                    </td>
                    <td className="mw-adleads-requirement">{orderItemSummary(order)}</td>
                    <td>
                      <strong>{orderTotal(order)}</strong>
                    </td>
                    <td>
                      <span
                        className={`mw-dealer-chip ${order.paymentStatus === "paid" ? "is-active" : "is-pending"}`}
                      >
                        {orderStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="mw-admin-input mw-adleads-status"
                        value={
                          ORDER_STATUSES.includes(order.status as OrderStatus)
                            ? order.status
                            : "pending"
                        }
                        disabled={updating === order.id}
                        aria-label={`Fulfilment status for ${order.orderRef}`}
                        onChange={(event) =>
                          void changeStatus(order, event.target.value as OrderStatus)
                        }
                        data-testid={`order-status-${order.id}`}
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {orderStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          First time here? Run <code>supabase/admin-features.sql</code> so staff can read every
          order and update its status.
        </p>
      </section>
    </div>
  );
}
