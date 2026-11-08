import { useEffect, useMemo, useState } from "react";
import { Printer, Search, StickyNote } from "lucide-react";

import {
  APPLICATION_STATUSES,
  JOB_STATUSES,
  ORDER_STATUSES,
  SALES_STATUSES,
  deskCounts,
  inr,
  readDeskRows,
  updateApplication,
  updateJobCard,
  updateOrder,
  updateSalesLead,
  type Application,
  type DeskResult,
  type FulfilmentOrder,
  type JobCard,
  type SalesLead,
} from "@/lib/employee-desk";
import { canEditCase, type Actor } from "@/lib/admin-rbac";
import {
  ContactActions,
  DeskDrawer,
  DeskEmpty,
  DeskKpis,
  StatusSelect,
  useDeskRows,
} from "./DeskUI";

type DeskActor = Actor & { category: string | null };

type Flash = { tone: "ok" | "error"; text: string } | null;

function useFlash() {
  const [flash, setFlash] = useState<Flash>(null);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 3600);
    return () => window.clearTimeout(timer);
  }, [flash]);
  return { flash, setFlash };
}

function FlashBar({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <p className={`mw-desk-flash is-${flash.tone}`} role="status">
      {flash.text}
    </p>
  );
}

function report(result: DeskResult, setFlash: (flash: Flash) => void, success: string) {
  if (result.ok) setFlash({ tone: "ok", text: success });
  else setFlash({ tone: "error", text: result.error });
}

function DeskToolbar({
  query,
  onQuery,
  status,
  onStatus,
  statuses,
  placeholder,
  trailing,
}: {
  query: string;
  onQuery: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  statuses: readonly string[];
  placeholder: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mw-desk-toolbar">
      <label className="mw-desk-search">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      <label className="mw-desk-filter">
        <span>Status</span>
        <select value={status} onChange={(event) => onStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {trailing}
    </div>
  );
}

const notesLabel = (count: number) => (count === 1 ? "1 note" : `${count} notes`);

/* ------------------------------------------------------------- vehicle sales */

export function SalesLeadsView({ actor }: { actor: DeskActor }) {
  const leads = useDeskRows<SalesLead>("sales", () => readDeskRows<SalesLead>(actor, "sales"));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, setFlash } = useFlash();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .filter((lead) => status === "all" || lead.status === status)
      .filter((lead) =>
        needle
          ? [lead.customerName, lead.mobile, lead.vehicle, lead.source]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [leads, query, status]);

  const counts = deskCounts("sales", leads);
  const open = leads.find((lead) => lead.id === openId) ?? null;
  const mayEdit = (lead: SalesLead) =>
    canEditCase(actor, { type: "Sell", assignedTo: lead.assignedTo });

  return (
    <div className="mw-desk">
      <DeskKpis
        items={[
          {
            label: "Open leads",
            value: String(counts.open),
            hint: `${counts.total} total`,
            tone: "brand",
          },
          {
            label: "Follow-ups due",
            value: String(leads.filter((lead) => lead.status === "Follow-up").length),
            hint: "Waiting on the customer",
            tone: "warn",
          },
          {
            label: "In the pipeline",
            value: String(leads.filter((lead) => lead.status === "Deal in Process").length),
            hint: "Paperwork or approval",
          },
          { label: "Deals closed", value: String(counts.settled), hint: "This board", tone: "ok" },
        ]}
      />

      <section className="mw-desk-panel">
        <header className="mw-desk-panelhead">
          <div>
            <h2>Lead management</h2>
            <p>Every enquiry this desk owns. Update the status inline, or open a lead for notes.</p>
          </div>
        </header>

        <DeskToolbar
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          statuses={SALES_STATUSES}
          placeholder="Search name, mobile, vehicle or source"
        />

        <FlashBar flash={flash} />

        {rows.length === 0 ? (
          <DeskEmpty title="No leads match" body="Try a different status or clear the search." />
        ) : (
          <div className="mw-desk-tablewrap">
            <table className="mw-desk-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Vehicle interested</th>
                  <th>Lead source</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.customerName}</strong>
                      <small>{new Date(lead.createdAt).toLocaleDateString("en-IN")}</small>
                    </td>
                    <td>
                      <ContactActions mobile={lead.mobile} name={lead.customerName} />
                      <small>{lead.mobile}</small>
                    </td>
                    <td>{lead.vehicle}</td>
                    <td>
                      <span className="mw-desk-source">{lead.source}</span>
                    </td>
                    <td>
                      <StatusSelect
                        label={`Status for ${lead.customerName}`}
                        value={lead.status}
                        options={SALES_STATUSES}
                        disabled={!mayEdit(lead)}
                        onChange={(next) =>
                          report(
                            updateSalesLead(actor, lead.id, {
                              status: next as SalesLead["status"],
                            }),
                            setFlash,
                            `${lead.customerName} moved to ${next}.`,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="mw-desk-link" onClick={() => setOpenId(lead.id)}>
                        <StickyNote size={14} /> {notesLabel(lead.notes.length)}
                      </button>
                    </td>
                    <td>
                      <button className="mw-desk-open" onClick={() => setOpenId(lead.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeskDrawer
        open={Boolean(open)}
        title={open?.customerName ?? ""}
        subtitle={open ? `${open.vehicle} · ${open.source}` : ""}
        facts={
          open
            ? [
                { label: "Mobile", value: open.mobile },
                { label: "Lead source", value: open.source },
                { label: "Status", value: open.status },
                { label: "Owner", value: open.assignedTo ?? "Unassigned" },
              ]
            : []
        }
        notes={open?.notes ?? []}
        noteLabel="Follow-up notes"
        busy={false}
        onClose={() => setOpenId(null)}
        onAddNote={(text) => {
          if (!open) return;
          report(
            updateSalesLead(actor, open.id, { note: text }),
            setFlash,
            "Follow-up note saved.",
          );
        }}
      >
        {open ? (
          <div className="mw-desk-draweractions">
            <ContactActions mobile={open.mobile} name={open.customerName} />
          </div>
        ) : null}
      </DeskDrawer>
    </div>
  );
}

/* ------------------------------------------------------------------ workshop */

export function WorkshopBoard({ actor }: { actor: DeskActor }) {
  const jobs = useDeskRows<JobCard>("workshop", () => readDeskRows<JobCard>(actor, "workshop"));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, setFlash } = useFlash();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs
      .filter((job) => status === "all" || job.status === status)
      .filter((job) =>
        needle
          ? [job.customerName, job.vehicleNumber, job.vehicle, job.serviceType, job.jobRef]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [jobs, query, status]);

  const budget = jobs.reduce((total, job) => total + job.estimatedCost, 0);
  const open = jobs.find((job) => job.id === openId) ?? null;
  const mayEdit = (job: JobCard) =>
    canEditCase(actor, { type: "Service", assignedTo: job.assignedTo });

  return (
    <div className="mw-desk">
      <DeskKpis
        items={[
          {
            label: "Vehicles in the bay",
            value: String(jobs.filter((job) => job.status === "In Progress").length),
            hint: `${jobs.length} job cards`,
            tone: "brand",
          },
          {
            label: "Waiting for parts",
            value: String(jobs.filter((job) => job.status === "Waiting for Parts").length),
            hint: "Blocked on supply",
            tone: "warn",
          },
          {
            label: "Ready for delivery",
            value: String(jobs.filter((job) => job.status === "Ready for Delivery").length),
            hint: "Quality check cleared",
          },
          {
            label: "Estimated work",
            value: inr(budget),
            hint: "All job cards on this board",
            tone: "ok",
          },
        ]}
      />

      <section className="mw-desk-panel">
        <header className="mw-desk-panelhead">
          <div>
            <h2>Job cards & repair status</h2>
            <p>Move a vehicle through the bay. Mechanic notes stay on the job card.</p>
          </div>
        </header>

        <DeskToolbar
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          statuses={JOB_STATUSES}
          placeholder="Search customer, vehicle number or job card"
        />

        <FlashBar flash={flash} />

        {rows.length === 0 ? (
          <DeskEmpty title="No job cards match" body="Try another status or clear the search." />
        ) : (
          <div className="mw-desk-tablewrap">
            <table className="mw-desk-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle number</th>
                  <th>Service type</th>
                  <th>Job card status</th>
                  <th>Est. cost</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.customerName}</strong>
                      <small>
                        {job.jobRef} · {job.vehicle}
                      </small>
                    </td>
                    <td>
                      <span className="mw-desk-plate">{job.vehicleNumber}</span>
                    </td>
                    <td>{job.serviceType}</td>
                    <td>
                      <StatusSelect
                        label={`Job status for ${job.vehicleNumber}`}
                        value={job.status}
                        options={JOB_STATUSES}
                        disabled={!mayEdit(job)}
                        onChange={(next) =>
                          report(
                            updateJobCard(actor, job.id, { status: next as JobCard["status"] }),
                            setFlash,
                            `${job.jobRef} moved to ${next}.`,
                          )
                        }
                      />
                    </td>
                    <td>{inr(job.estimatedCost)}</td>
                    <td>
                      <button className="mw-desk-open" onClick={() => setOpenId(job.id)}>
                        Mechanic notes ({job.notes.length})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeskDrawer
        open={Boolean(open)}
        title={open ? `${open.jobRef} · ${open.vehicleNumber}` : ""}
        subtitle={open ? `${open.customerName} — ${open.serviceType}` : ""}
        facts={
          open
            ? [
                { label: "Vehicle", value: open.vehicle },
                { label: "Status", value: open.status },
                { label: "Estimated cost", value: inr(open.estimatedCost) },
                { label: "Opened", value: new Date(open.createdAt).toLocaleString("en-IN") },
              ]
            : []
        }
        notes={open?.notes ?? []}
        noteLabel="Mechanic notes"
        busy={false}
        onClose={() => setOpenId(null)}
        onAddNote={(text) => {
          if (!open) return;
          report(
            updateJobCard(actor, open.id, { note: text }),
            setFlash,
            "Mechanic note added to the job card.",
          );
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ parts & decor */

function InvoiceBody({ order }: { order: FulfilmentOrder }) {
  return (
    <div className="mw-desk-invoice">
      <header>
        <strong>Motor Wallah</strong>
        <span>Invoice · {order.orderRef}</span>
      </header>
      <p>
        {order.customerName}
        <br />
        {order.mobile}
      </p>
      <table>
        <tbody>
          <tr>
            <td>{order.items}</td>
            <td>{inr(order.total)}</td>
          </tr>
        </tbody>
      </table>
      <footer>
        <span>Total</span>
        <strong>{inr(order.total)}</strong>
      </footer>
      <small>Mock invoice for desk demonstration — not a tax document.</small>
    </div>
  );
}

export function OrderFulfilmentView({ actor }: { actor: DeskActor }) {
  const orders = useDeskRows<FulfilmentOrder>("parts", () =>
    readDeskRows<FulfilmentOrder>(actor, "parts"),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const { flash, setFlash } = useFlash();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders
      .filter((order) => status === "all" || order.status === status)
      .filter((order) =>
        needle
          ? [order.orderRef, order.customerName, order.items, order.mobile]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [orders, query, status]);

  const counts = deskCounts("parts", orders);
  const open = orders.find((order) => order.id === openId) ?? null;
  const invoice = orders.find((order) => order.id === invoiceId) ?? null;
  const mayEdit = (order: FulfilmentOrder) =>
    canEditCase(actor, { type: "Parts Order", assignedTo: order.assignedTo });

  return (
    <div className="mw-desk">
      <DeskKpis
        items={[
          {
            label: "Orders on the desk",
            value: String(counts.total),
            hint: "Parts & decor",
            tone: "brand",
          },
          {
            label: "To pack",
            value: String(orders.filter((order) => order.status === "Pending").length),
            hint: "Awaiting dispatch",
            tone: "warn",
          },
          {
            label: "In transit",
            value: String(orders.filter((order) => order.status === "Shipped").length),
            hint: "With the courier",
          },
          {
            label: "Fulfilment value",
            value: inr(counts.value),
            hint: "Excludes cancelled",
            tone: "ok",
          },
        ]}
      />

      <section className="mw-desk-panel">
        <header className="mw-desk-panelhead">
          <div>
            <h2>Order fulfilment</h2>
            <p>Update fulfilment status and print a mock invoice for the counter.</p>
          </div>
        </header>

        <DeskToolbar
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          statuses={ORDER_STATUSES}
          placeholder="Search order ref, customer or items"
        />

        <FlashBar flash={flash} />

        {rows.length === 0 ? (
          <DeskEmpty title="No orders match" body="Try another status or clear the search." />
        ) : (
          <div className="mw-desk-tablewrap">
            <table className="mw-desk-table">
              <thead>
                <tr>
                  <th>Order ref</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Order status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderRef}</strong>
                      <small>{new Date(order.createdAt).toLocaleDateString("en-IN")}</small>
                    </td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <small>{order.mobile}</small>
                    </td>
                    <td>{order.items}</td>
                    <td>{inr(order.total)}</td>
                    <td>
                      <StatusSelect
                        label={`Order status for ${order.orderRef}`}
                        value={order.status}
                        options={ORDER_STATUSES}
                        disabled={!mayEdit(order)}
                        onChange={(next) =>
                          report(
                            updateOrder(actor, order.id, { status: next as OrderStatusNext }),
                            setFlash,
                            `${order.orderRef} moved to ${next}.`,
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className="mw-desk-actions">
                        <button className="mw-desk-open" onClick={() => setOpenId(order.id)}>
                          Notes
                        </button>
                        <button
                          className="mw-desk-link"
                          onClick={() => setInvoiceId(order.id)}
                          title="Mock invoice"
                        >
                          <Printer size={14} /> Invoice
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeskDrawer
        open={Boolean(open)}
        title={open?.orderRef ?? ""}
        subtitle={open ? `${open.customerName} · ${open.items}` : ""}
        facts={
          open
            ? [
                { label: "Mobile", value: open.mobile },
                { label: "Status", value: open.status },
                { label: "Total", value: inr(open.total) },
                { label: "Owner", value: open.assignedTo ?? "Unassigned" },
              ]
            : []
        }
        notes={open?.notes ?? []}
        noteLabel="Fulfilment notes"
        busy={false}
        onClose={() => setOpenId(null)}
        onAddNote={(text) => {
          if (!open) return;
          report(updateOrder(actor, open.id, { note: text }), setFlash, "Fulfilment note saved.");
        }}
      />

      {invoice ? (
        <div className="mw-desk-drawer-root" role="dialog" aria-modal="true" aria-label="Invoice">
          <button
            className="mw-desk-backdrop"
            aria-label="Close"
            onClick={() => setInvoiceId(null)}
          />
          <aside className="mw-desk-drawer is-invoice">
            <header>
              <div>
                <h2>Invoice preview</h2>
                <p>Mock document — for desk demonstration only.</p>
              </div>
              <button
                className="mw-desk-close"
                onClick={() => setInvoiceId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <InvoiceBody order={invoice} />
            <button className="mw-desk-print" onClick={() => window.print()}>
              <Printer size={15} /> Print (mock)
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type OrderStatusNext = FulfilmentOrder["status"];

/* --------------------------------------------------------- finance & insurance */

export function ApplicationTrackerView({
  actor,
  desk,
}: {
  actor: DeskActor;
  desk: "finance" | "insurance";
}) {
  const applications = useDeskRows<Application>(desk, () => readDeskRows<Application>(actor, desk));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, setFlash } = useFlash();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications
      .filter((item) => status === "all" || item.status === status)
      .filter((item) =>
        needle
          ? [item.reference, item.customerName, item.vehicle, item.provider, item.mobile]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [applications, query, status]);

  const label = desk === "finance" ? "finance" : "insurance";
  const open = applications.find((item) => item.id === openId) ?? null;
  const mayEdit = (item: Application) =>
    canEditCase(actor, {
      type: desk === "finance" ? "Finance" : "Insurance",
      assignedTo: item.assignedTo,
    });
  const value = applications
    .filter((item) => item.status !== "Rejected")
    .reduce((total, item) => total + item.amount, 0);

  return (
    <div className="mw-desk">
      <DeskKpis
        items={[
          {
            label: "In review",
            value: String(applications.filter((item) => item.status === "Under Review").length),
            hint: `${applications.length} applications`,
            tone: "brand",
          },
          {
            label: "Awaiting first look",
            value: String(applications.filter((item) => item.status === "Submitted").length),
            hint: "Not picked up yet",
            tone: "warn",
          },
          {
            label: "Approved",
            value: String(applications.filter((item) => item.status === "Approved").length),
            hint: `${label === "finance" ? "Lender" : "Provider"} decision received`,
          },
          { label: "Book value", value: inr(value), hint: "Excludes rejected files", tone: "ok" },
        ]}
      />

      <section className="mw-desk-panel">
        <header className="mw-desk-panelhead">
          <div>
            <h2>Application tracker</h2>
            <p>
              Files this desk owns. Update the decision stage or add a note for the next person.
            </p>
          </div>
        </header>

        <DeskToolbar
          query={query}
          onQuery={setQuery}
          status={status}
          onStatus={setStatus}
          statuses={APPLICATION_STATUSES}
          placeholder="Search customer, vehicle, reference or provider"
        />

        <FlashBar flash={flash} />

        {rows.length === 0 ? (
          <DeskEmpty title="No applications match" body="Try another status or clear the search." />
        ) : (
          <div className="mw-desk-tablewrap">
            <table className="mw-desk-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>{label === "finance" ? "Bank" : "Provider"}</th>
                  <th>Amount</th>
                  <th>Application status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.customerName}</strong>
                      <small>
                        {item.reference} · {item.mobile}
                      </small>
                    </td>
                    <td>{item.vehicle}</td>
                    <td>{item.provider}</td>
                    <td>{inr(item.amount)}</td>
                    <td>
                      <StatusSelect
                        label={`Application status for ${item.customerName}`}
                        value={item.status}
                        options={APPLICATION_STATUSES}
                        disabled={!mayEdit(item)}
                        onChange={(next) =>
                          report(
                            updateApplication(actor, desk, item.id, {
                              status: next as Application["status"],
                            }),
                            setFlash,
                            `${item.reference} moved to ${next}.`,
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="mw-desk-open" onClick={() => setOpenId(item.id)}>
                        Notes ({item.notes.length})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeskDrawer
        open={Boolean(open)}
        title={open?.customerName ?? ""}
        subtitle={open ? `${open.reference} · ${open.provider}` : ""}
        facts={
          open
            ? [
                { label: "Vehicle", value: open.vehicle },
                { label: "Mobile", value: open.mobile },
                { label: "Amount", value: inr(open.amount) },
                { label: "Status", value: open.status },
              ]
            : []
        }
        notes={open?.notes ?? []}
        noteLabel="Desk notes"
        busy={false}
        onClose={() => setOpenId(null)}
        onAddNote={(text) => {
          if (!open) return;
          report(
            updateApplication(actor, desk, open.id, { note: text }),
            setFlash,
            "Note saved to the application.",
          );
        }}
      />
    </div>
  );
}
