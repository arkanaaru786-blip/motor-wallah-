import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

import { PartnerShell, type PartnerTab } from "@/components/partner/PartnerShell";
import { relativeTime, rupees, shortDate } from "@/lib/dealer-format";
import { DECOR_CATEGORY_LIST } from "@/lib/decor-store";
import { PART_CATEGORY_LIST } from "@/lib/parts-store";
import {
  addInventoryItem,
  ORDER_STATUSES,
  orderTotal,
  partnerInventory,
  partnerOrders,
  removeInventoryItem,
  seedPartnerData,
  updateInventoryItem,
  updateOrderStatus,
  type InventoryInput,
  type OrderStatus,
  type PartnerOrder,
} from "@/lib/partner-data";
import { getPartnerType } from "@/lib/partners";
import type { PartnerSession } from "@/lib/partner-session";

const ORDER_CHIP: Record<OrderStatus, string> = {
  New: "is-new",
  Packed: "is-packed",
  Shipped: "is-shipped",
  Delivered: "is-delivered",
  Cancelled: "is-cancelled",
};

const TABS: PartnerTab[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "inventory", label: "Inventory", icon: Boxes },
];

const emptyForm = (
  category: string,
): InventoryInput & { priceText: string; stockText: string } => ({
  name: "",
  category,
  sku: "",
  price: 0,
  stock: 0,
  priceText: "",
  stockText: "",
});

/**
 * Order fulfilment desk for the Auto Parts and Decor portals. Both use the
 * same flow — incoming orders, status updates, a printable mock invoice and
 * stock management — with their own catalogues and labels.
 */
export function OrderPortal({ session }: { session: PartnerSession }) {
  const kind = session.type === "decor" ? "decor" : "parts";
  const def = getPartnerType(session.type);
  const categoryOptions = useMemo(
    () =>
      (kind === "decor" ? DECOR_CATEGORY_LIST : PART_CATEGORY_LIST).map((category) => ({
        label: category.label,
      })),
    [kind],
  );

  const [tab, setTab] = useState("overview");
  const [version, setVersion] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<PartnerOrder | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(categoryOptions[0]?.label ?? "General"));

  useEffect(() => {
    seedPartnerData({ partnerId: session.partnerId, type: session.type });
    setSeeded(true);
    setSelectedId(null);
    setEditingId(null);
    setFlash(null);
    setError(null);
  }, [session.partnerId, session.type]);

  const orders = useMemo(() => {
    if (!seeded) return [];
    return partnerOrders(session.partnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.partnerId, version, seeded]);

  const inventory = useMemo(() => {
    if (!seeded) return [];
    return partnerInventory(session.partnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.partnerId, version, seeded]);

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const newOrders = orders.filter((order) => order.status === "New");
  const inFulfilment = orders.filter(
    (order) => order.status === "Packed" || order.status === "Shipped",
  );
  const delivered = orders.filter((order) => order.status === "Delivered");
  const lowStock = inventory.filter((item) => item.stock <= 5);

  const visibleOrders = orders.filter((order) => {
    if (filter !== "all" && order.status !== filter) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [
      order.id,
      order.customerName,
      order.mobile,
      order.city,
      ...order.items.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const changed = (message: string) => {
    setVersion((value) => value + 1);
    setFlash(message);
    setError(null);
  };

  const saveItem = () => {
    const input: InventoryInput = {
      name: form.name,
      category: form.category,
      sku: form.sku,
      price: Number(form.priceText),
      stock: Number(form.stockText),
    };
    const result = editingId
      ? updateInventoryItem(session.partnerId, editingId, input)
      : addInventoryItem(session.partnerId, input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    changed(editingId ? "Stock item updated." : "Stock item added.");
    setEditingId(null);
    setForm(emptyForm(categoryOptions[0]?.label ?? "General"));
  };

  return (
    <PartnerShell session={session} tabs={TABS} active={tab} onTab={setTab}>
      {flash ? (
        <p className="mw-dealer-flash" role="status" data-testid="partner-orders-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-dealer-error" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "overview" ? (
        <>
          <div className="mw-dealer-head">
            <div>
              <h1>{def.label} order fulfilment</h1>
              <p>
                Incoming {kind === "decor" ? "decor" : "auto parts"} orders for {session.business}.
                Move each order from New to Delivered and print its invoice.
              </p>
            </div>
          </div>

          <section className="mw-dealer-kpis">
            <article className="mw-dealer-kpi is-hero">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <ShoppingBag size={16} />
                </span>
                <span className="mw-dealer-kpi-label">New orders</span>
              </header>
              <strong className="mw-dealer-kpi-value">{newOrders.length}</strong>
              <footer>Waiting to be picked and packed.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <Package size={16} />
                </span>
                <span className="mw-dealer-kpi-label">In fulfilment</span>
              </header>
              <strong className="mw-dealer-kpi-value">{inFulfilment.length}</strong>
              <footer>Packed or shipped, on the way to the customer.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <CheckCircle2 size={16} />
                </span>
                <span className="mw-dealer-kpi-label">Delivered</span>
              </header>
              <strong className="mw-dealer-kpi-value">{delivered.length}</strong>
              <footer>Completed orders in this account.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <Boxes size={16} />
                </span>
                <span className="mw-dealer-kpi-label">Stock items</span>
              </header>
              <strong className="mw-dealer-kpi-value">{inventory.length}</strong>
              <footer>
                {lowStock.length} item{lowStock.length === 1 ? "" : "s"} at 5 units or less.
              </footer>
            </article>
          </section>

          <section className="mw-dealer-panels">
            <article className="mw-dealer-panel is-wide">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <ShoppingBag size={15} /> Latest orders
                  </h2>
                  <p>The newest orders in your queue, with the customer and order value.</p>
                </div>
                <button
                  type="button"
                  className="mw-dealer-btn is-small"
                  onClick={() => setTab("orders")}
                >
                  All orders
                </button>
              </div>
              {orders.length === 0 ? (
                <p className="mw-dealer-empty">No orders yet.</p>
              ) : (
                <ul className="mw-partner-joblist">
                  {orders.slice(0, 5).map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(order.id);
                          setTab("orders");
                        }}
                      >
                        <span className="mw-partner-joblist-lead">
                          <strong>{order.id}</strong>
                          <span>
                            {order.customerName} · {order.city} · {order.items.length} item
                            {order.items.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="mw-partner-joblist-meta">
                          <span className={`mw-dealer-chip ${ORDER_CHIP[order.status]}`}>
                            {order.status}
                          </span>
                          <span>{rupees(orderTotal(order))}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="mw-dealer-panel">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <Boxes size={15} /> Low stock
                  </h2>
                  <p>Items to reorder before the next sale.</p>
                </div>
              </div>
              <ul className="mw-dealer-feed">
                {lowStock.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <div className="is-meta">{item.sku}</div>
                    </div>
                    <span className="is-meta">{item.stock} left</span>
                  </li>
                ))}
                {lowStock.length === 0 ? <li>Every item is above the low-stock mark.</li> : null}
              </ul>
            </article>

            <article className="mw-dealer-panel">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <FileText size={15} /> Invoices
                  </h2>
                  <p>Open an order to print its mock invoice.</p>
                </div>
              </div>
              <ul className="mw-dealer-feed">
                {delivered.slice(0, 4).map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>{order.id}</strong>
                      <div className="is-meta">{shortDate(order.placedAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="mw-dealer-btn is-small"
                      onClick={() => setInvoiceFor(order)}
                    >
                      <Printer size={12} /> Invoice
                    </button>
                  </li>
                ))}
                {delivered.length === 0 ? <li>No delivered orders to invoice yet.</li> : null}
              </ul>
            </article>
          </section>
        </>
      ) : null}

      {tab === "orders" ? (
        <>
          <div className="mw-dealer-head">
            <div>
              <h1>Order fulfilment</h1>
              <p>
                Update the status of every {kind === "decor" ? "decor" : "auto parts"} order
                assigned to this partner. New → Packed → Shipped → Delivered, or Cancelled.
              </p>
            </div>
            <div className="mw-partner-toolbar">
              <label className="mw-partner-search">
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">Search orders</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order, customer, item…"
                  data-testid="partner-order-search"
                />
              </label>
              <label className="mw-admin-select">
                <span className="sr-only">Filter by order status</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as OrderStatus | "all")}
                  data-testid="partner-order-filter"
                >
                  <option value="all">All statuses</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <section className="mw-dealer-panel">
            {visibleOrders.length === 0 ? (
              <p className="mw-dealer-empty">No orders match this filter.</p>
            ) : (
              <div className="mw-dealer-tablewrap">
                <table className="mw-dealer-table" data-testid="partner-order-table">
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Items</th>
                      <th scope="col">Total</th>
                      <th scope="col">Status</th>
                      <th scope="col">Placed</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id} data-testid={`partner-order-row-${order.id}`}>
                        <td>
                          <strong>{order.id}</strong>
                          <div className="is-muted">{order.items.length} line item(s)</div>
                        </td>
                        <td>
                          <strong>{order.customerName}</strong>
                          <div className="is-muted">
                            {order.mobile} · {order.city}
                          </div>
                        </td>
                        <td>{order.items.map((item) => item.name).join(", ")}</td>
                        <td className="is-num">{rupees(orderTotal(order))}</td>
                        <td>
                          <span className={`mw-dealer-chip ${ORDER_CHIP[order.status]}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="is-muted">{shortDate(order.placedAt)}</td>
                        <td>
                          <div className="mw-dealer-actions">
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              onClick={() => setSelectedId(order.id)}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              onClick={() => setInvoiceFor(order)}
                            >
                              <Printer size={12} /> Invoice
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

          {selected ? (
            <OrderDetail
              key={selected.id}
              order={selected}
              onChanged={changed}
              onError={setError}
              onInvoice={() => setInvoiceFor(selected)}
            />
          ) : (
            <p className="mw-dealer-scope-note">
              <ClipboardList size={15} />
              <span>
                Select <strong>Open</strong> on an order to change its status, see the delivery
                address and print its invoice.
              </span>
            </p>
          )}
        </>
      ) : null}

      {tab === "inventory" ? (
        <>
          <div className="mw-dealer-head">
            <div>
              <h1>Inventory management</h1>
              <p>
                Add, edit or remove the {kind === "decor" ? "decor" : "auto parts"} items this shop
                stocks. Prices are shown to the Motor Wallah team, not charged here.
              </p>
            </div>
          </div>

          <section className="mw-dealer-panel">
            <div className="mw-dealer-panel-head">
              <div>
                <h2>
                  <Plus size={15} /> {editingId ? "Edit stock item" : "Add a stock item"}
                </h2>
                <p>SKU is optional — one is generated when it is left blank.</p>
              </div>
              {editingId ? (
                <button
                  type="button"
                  className="mw-dealer-btn is-small is-quiet"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm(categoryOptions[0]?.label ?? "General"));
                  }}
                >
                  <X size={13} /> Cancel edit
                </button>
              ) : null}
            </div>

            <form
              className="mw-dealer-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveItem();
              }}
              data-testid="partner-inventory-form"
            >
              <label className="mw-dealer-field is-span-3">
                <span>Item name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder={
                    kind === "decor" ? "Vega Full Seat Cover Set" : "Bosch Front Brake Pad Set"
                  }
                  required
                />
              </label>
              <label className="mw-dealer-field">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                >
                  {categoryOptions.map((category) => (
                    <option key={category.label} value={category.label}>
                      {category.label}
                    </option>
                  ))}
                  {!categoryOptions.some((category) => category.label === form.category) ? (
                    <option value={form.category}>{form.category}</option>
                  ) : null}
                </select>
              </label>
              <label className="mw-dealer-field">
                <span>Price (₹)</span>
                <input
                  value={form.priceText}
                  onChange={(event) => setForm({ ...form, priceText: event.target.value })}
                  inputMode="numeric"
                  placeholder="2490"
                  required
                />
              </label>
              <label className="mw-dealer-field">
                <span>Stock on hand</span>
                <input
                  value={form.stockText}
                  onChange={(event) => setForm({ ...form, stockText: event.target.value })}
                  inputMode="numeric"
                  placeholder="12"
                  required
                />
              </label>
              <label className="mw-dealer-field">
                <span>SKU</span>
                <input
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  placeholder="BRK-1042"
                />
              </label>
              <div className="mw-dealer-form-actions">
                <button type="submit" className="mw-dealer-btn is-primary">
                  <Plus size={15} /> {editingId ? "Save item" : "Add item"}
                </button>
              </div>
            </form>
          </section>

          <section className="mw-dealer-panel">
            <div className="mw-dealer-panel-head">
              <div>
                <h2>
                  <Boxes size={15} /> Stock on hand
                </h2>
                <p>
                  {inventory.length} item{inventory.length === 1 ? "" : "s"} in this shop&apos;s
                  inventory.
                </p>
              </div>
            </div>

            {inventory.length === 0 ? (
              <p className="mw-dealer-empty">No stock items yet — add the first one above.</p>
            ) : (
              <div className="mw-dealer-tablewrap">
                <table className="mw-dealer-table" data-testid="partner-inventory-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Category</th>
                      <th scope="col">SKU</th>
                      <th scope="col">Price</th>
                      <th scope="col">Stock</th>
                      <th scope="col">Updated</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>{item.category}</td>
                        <td className="is-muted">{item.sku}</td>
                        <td className="is-num">{rupees(item.price)}</td>
                        <td>
                          <span
                            className={`mw-dealer-chip ${item.stock <= 5 ? "is-pending" : "is-active"}`}
                          >
                            {item.stock}
                          </span>
                        </td>
                        <td className="is-muted">{relativeTime(item.updatedAt)}</td>
                        <td>
                          <div className="mw-dealer-actions">
                            <button
                              type="button"
                              className="mw-dealer-btn is-small"
                              onClick={() => {
                                setEditingId(item.id);
                                setForm({
                                  name: item.name,
                                  category: item.category,
                                  sku: item.sku,
                                  price: item.price,
                                  stock: item.stock,
                                  priceText: String(item.price),
                                  stockText: String(item.stock),
                                });
                                setTab("inventory");
                              }}
                              data-testid={`partner-inventory-edit-${item.id}`}
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-danger"
                              onClick={() => {
                                const result = removeInventoryItem(session.partnerId, item.id);
                                if (!result.ok) setError(result.error);
                                else changed("Stock item removed.");
                                if (editingId === item.id) {
                                  setEditingId(null);
                                  setForm(emptyForm(categoryOptions[0]?.label ?? "General"));
                                }
                              }}
                              data-testid={`partner-inventory-remove-${item.id}`}
                            >
                              <Trash2 size={12} />
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
        </>
      ) : null}

      {invoiceFor ? (
        <InvoiceModal
          order={invoiceFor}
          business={session.business}
          partnerId={session.partnerId}
          city={session.city}
          mobile={session.mobile}
          onClose={() => setInvoiceFor(null)}
        />
      ) : null}
    </PartnerShell>
  );
}

function OrderDetail({
  order,
  onChanged,
  onError,
  onInvoice,
}: {
  order: PartnerOrder;
  onChanged: (message: string) => void;
  onError: (message: string | null) => void;
  onInvoice: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [error, setError] = useState<string | null>(null);
  const total = orderTotal(order);

  return (
    <section className="mw-dealer-panel is-wide" data-testid={`partner-order-detail-${order.id}`}>
      <div className="mw-dealer-panel-head">
        <div>
          <h2>
            <ClipboardList size={15} /> Order {order.id}
          </h2>
          <p>
            Placed {shortDate(order.placedAt)} · updated {relativeTime(order.updatedAt)}
          </p>
        </div>
        <div className="mw-dealer-actions">
          <span className={`mw-dealer-chip ${ORDER_CHIP[order.status]}`}>{order.status}</span>
          <button type="button" className="mw-dealer-btn is-small" onClick={onInvoice}>
            <Printer size={13} /> Print invoice
          </button>
        </div>
      </div>

      {error ? (
        <p className="mw-dealer-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mw-partner-facts">
        <div>
          <span>Customer</span>
          <strong>{order.customerName}</strong>
        </div>
        <div>
          <span>Mobile</span>
          <strong>{order.mobile}</strong>
        </div>
        <div>
          <span>Delivery city</span>
          <strong>{order.city}</strong>
        </div>
        <div>
          <span>Order value</span>
          <strong>{rupees(total)}</strong>
        </div>
      </div>

      <p className="mw-partner-address">
        <strong>Delivery address:</strong> {order.address}
      </p>

      <div className="mw-partner-detail-grid">
        <div className="mw-partner-block">
          <h3>Update status</h3>
          <div className="mw-partner-inline">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
              aria-label="Order status"
              data-testid="partner-order-status-select"
            >
              {ORDER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mw-dealer-btn is-primary is-small"
              onClick={() => {
                const result = updateOrderStatus(order.partnerId, order.id, status);
                if (!result.ok) {
                  setError(result.error);
                  onError(result.error);
                  return;
                }
                setError(null);
                onChanged(`Order ${order.id} marked ${status}.`);
              }}
              data-testid="partner-order-status-save"
            >
              Update order
            </button>
          </div>

          <h3>Status history</h3>
          <ol className="mw-partner-timeline">
            {order.history.map((entry, index) => (
              <li key={`${entry.status}-${index}`}>
                <span className={`mw-dealer-chip ${ORDER_CHIP[entry.status]}`}>{entry.status}</span>
                <span className="is-meta">
                  {new Date(entry.at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mw-partner-block">
          <h3>Items</h3>
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table mw-partner-mini-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Price</th>
                  <th scope="col">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td className="is-num">{rupees(item.price)}</td>
                    <td className="is-num">{rupees(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mw-partner-total">
            Order total <strong>{rupees(total)}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

function InvoiceModal({
  order,
  business,
  partnerId,
  city,
  mobile,
  onClose,
}: {
  order: PartnerOrder;
  business: string;
  partnerId: string;
  city: string;
  mobile: string;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("mw-printing-invoice");
    return () => document.body.classList.remove("mw-printing-invoice");
  }, []);

  const total = orderTotal(order);
  const invoiceNo = `INV-${order.id.replace("MW-ORD-", "")}`;

  return (
    <div
      className="mw-invoice-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${invoiceNo}`}
    >
      <div className="mw-invoice">
        <div className="mw-invoice-actions">
          <button
            type="button"
            className="mw-dealer-btn is-primary is-small"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print
          </button>
          <button type="button" className="mw-dealer-btn is-small" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>

        <div className="mw-invoice-print">
          <header className="mw-invoice-head">
            <div>
              <strong>MOTOR WALLAH</strong>
              <span>{business}</span>
              <span>
                {partnerId} · {city} · {mobile}
              </span>
            </div>
            <div className="mw-invoice-meta">
              <strong>Invoice</strong>
              <span>{invoiceNo}</span>
              <span>Order {order.id}</span>
              <span>{shortDate(order.placedAt)}</span>
            </div>
          </header>

          <section className="mw-invoice-billto">
            <span>Billed to</span>
            <strong>{order.customerName}</strong>
            <p>
              {order.address}
              <br />
              {order.city} · {order.mobile}
            </p>
          </section>

          <table className="mw-invoice-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Qty</th>
                <th scope="col">Rate</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                  <td>{rupees(item.price)}</td>
                  <td>{rupees(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mw-invoice-total">
            <span>Total payable</span>
            <strong>{rupees(total)}</strong>
          </div>

          <footer className="mw-invoice-foot">
            <p>Payment received online through Motor Wallah. Thank you for your order.</p>
            <small>
              Mock invoice for the demo build — not a GST tax document. Status: {order.status}.
            </small>
          </footer>
        </div>
      </div>
    </div>
  );
}
