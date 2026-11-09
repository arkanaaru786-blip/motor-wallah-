import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Inbox,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

import { relativeTime, rupees } from "@/lib/dealer-format";
import type { PartnerSession } from "@/lib/partner-session";
import {
  acceptEnquiry,
  addRepairItem,
  addReplaceItem,
  ENQUIRY_CHIP,
  estimateTotals,
  markVehicleReceived,
  MW_AUTO_PARTS,
  removeEnquiryLine,
  sendEstimate,
  setEnquiryDiscount,
  setEnquiryNotes,
  WORKSHOP_DEPARTMENTS,
  WORKSHOP_TEAM,
  workshopEnquiries,
  type EnquiryResult,
  type WorkshopEnquiry,
} from "@/lib/workshop-enquiries";

const departmentLabel = (enquiry: WorkshopEnquiry) =>
  WORKSHOP_DEPARTMENTS.find((item) => item.id === enquiry.department)?.label ?? "Workshop";

/** Date-only booking values must not shift a day when parsed as UTC. */
const dateLabel = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Service enquiry desk: claim a customer enquiry, choose pickup or workshop
 * visit, receive the vehicle, then build the repair/replacement checklist and
 * send the final estimate to the customer's Track Service dashboard.
 */
export function WorkshopEnquiries({
  session,
  onChanged,
}: {
  session: PartnerSession;
  onChanged: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => workshopEnquiries(session.partnerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.partnerId, version],
  );

  const visible = rows.filter((row) => {
    if (filter === "open" && (row.status === "Completed" || row.status === "Cancelled")) {
      return false;
    }
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [
      row.id,
      row.trackingId,
      row.customerName,
      row.mobile,
      row.vehicleNumber,
      row.vehicle,
      departmentLabel(row),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const fresh = rows.filter((row) => row.status === "New").length;
  const open = rows.filter(
    (row) => row.status !== "Completed" && row.status !== "Cancelled",
  ).length;

  const changed = (message: string) => {
    setVersion((value) => value + 1);
    setFlash(message);
    setError(null);
    onChanged();
  };

  const run = (result: EnquiryResult, message: string) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    changed(message);
  };

  return (
    <>
      {flash ? (
        <p className="mw-dealer-flash" role="status" data-testid="enquiry-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-dealer-error" role="alert" data-testid="enquiry-error">
          {error}
        </p>
      ) : null}

      <div className="mw-dealer-head">
        <div>
          <h1>Service enquiries</h1>
          <p>
            New customer enquiries arrive unclaimed. Accept one to assign a pickup or ask the
            customer to visit, then build the digital checklist and send the final estimate.
          </p>
        </div>
        <div className="mw-partner-toolbar">
          <label className="mw-partner-search">
            <Search size={14} aria-hidden="true" />
            <span className="sr-only">Search enquiries</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vehicle, customer, enquiry…"
              data-testid="enquiry-search"
            />
          </label>
          <label className="mw-admin-select">
            <span className="sr-only">Filter enquiries</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as "open" | "all")}
            >
              <option value="open">Open enquiries</option>
              <option value="all">All enquiries</option>
            </select>
          </label>
        </div>
      </div>

      <section className="mw-dealer-kpis mw-enq-kpis">
        <article className="mw-dealer-kpi is-hero">
          <header>
            <span className="mw-dealer-kpi-icon">
              <Inbox size={16} />
            </span>
            <span className="mw-dealer-kpi-label">New enquiries</span>
          </header>
          <strong className="mw-dealer-kpi-value">{fresh}</strong>
          <footer>Waiting for a workshop to accept and assign.</footer>
        </article>
        <article className="mw-dealer-kpi">
          <header>
            <span className="mw-dealer-kpi-icon">
              <ClipboardCheck size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Open jobs</span>
          </header>
          <strong className="mw-dealer-kpi-value">{open}</strong>
          <footer>Accepted, in the bay, or waiting for estimate approval.</footer>
        </article>
        <article className="mw-dealer-kpi">
          <header>
            <span className="mw-dealer-kpi-icon">
              <Send size={16} />
            </span>
            <span className="mw-dealer-kpi-label">Estimates sent</span>
          </header>
          <strong className="mw-dealer-kpi-value">
            {rows.filter((row) => row.status === "Estimate Sent").length}
          </strong>
          <footer>Visible on the customer&apos;s Track Service dashboard.</footer>
        </article>
      </section>

      {visible.length === 0 ? (
        <section className="mw-dealer-panel">
          <div className="mw-enq-empty">
            <Inbox size={30} aria-hidden="true" />
            <h2>{rows.length === 0 ? "No service enquiries yet" : "No matching enquiries"}</h2>
            <p>
              {rows.length === 0
                ? "When a customer books a service and picks a workshop department, the enquiry appears here automatically."
                : "Try clearing the search or choosing All enquiries."}
            </p>
          </div>
        </section>
      ) : (
        <div className="mw-enq-list" data-testid="enquiry-list">
          {visible.map((enquiry) => (
            <article
              key={enquiry.id}
              className="mw-enq-card"
              data-testid={`enquiry-card-${enquiry.id}`}
            >
              <div className="mw-enq-card-head">
                <span className={`mw-dealer-chip ${ENQUIRY_CHIP[enquiry.status]}`}>
                  {enquiry.status}
                </span>
                <span className="mw-enq-id">{enquiry.id}</span>
                <span className="mw-enq-when">{relativeTime(enquiry.createdAt)}</span>
              </div>
              <div className="mw-enq-card-body">
                <h2>{departmentLabel(enquiry)}</h2>
                <p className="mw-enq-service">{enquiry.serviceType}</p>
                <div className="mw-enq-vehicle">
                  <strong>{enquiry.vehicleNumber}</strong>
                  <span>
                    {enquiry.vehicle} · {enquiry.customerName}
                  </span>
                </div>
                <p className="mw-enq-issue">{enquiry.issue || "No issue description provided."}</p>
                <div className="mw-enq-tags">
                  <span>
                    <MapPin size={12} /> {enquiry.location}
                  </span>
                  <span>
                    <Truck size={12} /> {dateLabel(enquiry.preferredDate)} · {enquiry.preferredTime}
                  </span>
                  <span>
                    <Phone size={12} /> {enquiry.mobile}
                  </span>
                </div>
              </div>
              <div className="mw-enq-card-foot">
                <a
                  href={`tel:${enquiry.mobile}`}
                  className="mw-dealer-btn is-small"
                  data-testid={`enquiry-call-${enquiry.id}`}
                >
                  <Phone size={13} /> Call customer
                </a>
                <button
                  type="button"
                  className="mw-dealer-btn is-primary is-small"
                  onClick={() => {
                    setSelectedId(enquiry.id);
                    setError(null);
                    setFlash(null);
                  }}
                  data-testid={`enquiry-open-${enquiry.id}`}
                >
                  {enquiry.status === "New" ? "Accept & assign" : "Open checklist"}{" "}
                  <ChevronRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <EnquiryDetail
          key={`${selected.id}-${selected.status}-${selected.assignment?.acceptedAt ?? "none"}`}
          enquiry={selected}
          session={session}
          run={run}
          onDone={changed}
        />
      ) : null}
    </>
  );
}

function EnquiryDetail({
  enquiry,
  session,
  run,
  onDone,
}: {
  enquiry: WorkshopEnquiry;
  session: PartnerSession;
  run: (result: EnquiryResult, message: string) => void;
  onDone: (message: string) => void;
}) {
  return (
    <section
      className="mw-dealer-panel is-wide mw-partner-detail mw-enq-detail"
      data-testid={`enquiry-detail-${enquiry.id}`}
    >
      <div className="mw-dealer-panel-head">
        <div>
          <h2>
            <Inbox size={15} /> Enquiry {enquiry.id}
          </h2>
          <p>
            {enquiry.trackingId} · received {relativeTime(enquiry.createdAt)} ·{" "}
            {departmentLabel(enquiry)}
          </p>
        </div>
        <span className={`mw-dealer-chip ${ENQUIRY_CHIP[enquiry.status]}`}>{enquiry.status}</span>
      </div>

      <div className="mw-partner-facts">
        <div>
          <span>Customer</span>
          <strong>{enquiry.customerName}</strong>
        </div>
        <div>
          <span>Mobile</span>
          <strong>
            <a href={`tel:${enquiry.mobile}`} className="mw-partner-tel">
              <Phone size={13} /> {enquiry.mobile}
            </a>
          </strong>
        </div>
        <div>
          <span>Vehicle number</span>
          <strong className="mw-partner-plate">{enquiry.vehicleNumber}</strong>
        </div>
        <div>
          <span>Vehicle</span>
          <strong>{enquiry.vehicle}</strong>
        </div>
        <div>
          <span>Department</span>
          <strong>{departmentLabel(enquiry)}</strong>
        </div>
        <div>
          <span>Preferred slot</span>
          <strong>
            {dateLabel(enquiry.preferredDate)} · {enquiry.preferredTime}
          </strong>
        </div>
      </div>

      <div className="mw-enq-brief">
        <div>
          <span>Reported issue</span>
          <p>{enquiry.issue || "No issue description provided."}</p>
        </div>
        <div>
          <span>Pickup / visit address</span>
          <p>{enquiry.location}</p>
        </div>
      </div>

      <div className="mw-enq-actions">
        <a href={`tel:${enquiry.mobile}`} className="mw-dealer-btn is-primary is-small">
          <Phone size={14} /> Call customer
        </a>
        {enquiry.status === "Accepted" && enquiry.assignment?.mode === "visit" ? (
          <span className="mw-dealer-field-hint">
            Customer has been asked to visit {enquiry.workshopName ?? session.business}.
          </span>
        ) : null}
        {enquiry.status === "Accepted" ? (
          <button
            type="button"
            className="mw-dealer-btn is-small"
            onClick={() =>
              run(
                markVehicleReceived(session.partnerId, enquiry.id),
                "Vehicle marked as received. The checklist is ready.",
              )
            }
            data-testid="enquiry-receive"
          >
            <Truck size={14} /> Mark vehicle received
          </button>
        ) : null}
      </div>

      {enquiry.status === "New" ? (
        <AcceptPanel enquiry={enquiry} session={session} run={run} />
      ) : null}

      {enquiry.assignment ? (
        <div className="mw-enq-assignment" data-testid="enquiry-assignment">
          <span className="mw-enq-section-kicker">
            {enquiry.assignment.mode === "pickup" ? "Pickup assigned" : "Workshop visit"}
          </span>
          <div className="mw-enq-assignment-grid">
            <div>
              <span>Plan</span>
              <strong>
                {enquiry.assignment.mode === "pickup"
                  ? "Employee picks up the vehicle"
                  : "Customer visits the workshop"}
              </strong>
            </div>
            <div>
              <span>Employee</span>
              <strong>{enquiry.assignment.employeeName ?? "No employee assigned"}</strong>
            </div>
            <div>
              <span>Employee mobile</span>
              <strong>
                {enquiry.assignment.employeeMobile ? (
                  <a href={`tel:${enquiry.assignment.employeeMobile}`} className="mw-partner-tel">
                    <Phone size={13} /> {enquiry.assignment.employeeMobile}
                  </a>
                ) : (
                  "—"
                )}
              </strong>
            </div>
            <div>
              <span>Accepted</span>
              <strong>{relativeTime(enquiry.assignment.acceptedAt)}</strong>
            </div>
          </div>
          {enquiry.assignment.note ? (
            <p className="mw-dealer-field-hint">{enquiry.assignment.note}</p>
          ) : null}
        </div>
      ) : null}

      {enquiry.status === "Vehicle Received" || enquiry.status === "Estimate Sent" ? (
        <ChecklistBuilder enquiry={enquiry} session={session} run={run} onDone={onDone} />
      ) : null}

      <div className="mw-enq-timeline">
        <h3>Enquiry timeline</h3>
        <ol className="mw-partner-timeline">
          {enquiry.timeline.map((entry, index) => (
            <li key={`${entry.status}-${index}`}>
              <span className={`mw-dealer-chip ${ENQUIRY_CHIP[entry.status]}`}>{entry.status}</span>
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
    </section>
  );
}

function AcceptPanel({
  enquiry,
  session,
  run,
}: {
  enquiry: WorkshopEnquiry;
  session: PartnerSession;
  run: (result: EnquiryResult, message: string) => void;
}) {
  const drivers = WORKSHOP_TEAM.filter((member) => member.role === "Pickup driver");
  const [mode, setMode] = useState<"pickup" | "visit">("pickup");
  const [employeeId, setEmployeeId] = useState(drivers[0]?.id ?? WORKSHOP_TEAM[0]?.id ?? "");
  const [note, setNote] = useState("");

  return (
    <div className="mw-enq-accept" data-testid="enquiry-accept-panel">
      <div className="mw-enq-section-head">
        <div>
          <span className="mw-enq-section-kicker">Accept &amp; assign</span>
          <h3>How should the vehicle reach the workshop?</h3>
        </div>
      </div>

      <div className="mw-enq-modes">
        <button
          type="button"
          className="mw-enq-mode"
          data-active={mode === "pickup" ? "true" : "false"}
          onClick={() => setMode("pickup")}
          data-testid="enquiry-mode-pickup"
        >
          <Truck size={18} />
          <span>
            <strong>Assign a pickup</strong>
            <small>An employee collects the vehicle from the customer.</small>
          </span>
        </button>
        <button
          type="button"
          className="mw-enq-mode"
          data-active={mode === "visit" ? "true" : "false"}
          onClick={() => setMode("visit")}
          data-testid="enquiry-mode-visit"
        >
          <MapPin size={18} />
          <span>
            <strong>Ask customer to visit</strong>
            <small>Share the workshop address and confirm the slot by call.</small>
          </span>
        </button>
      </div>

      <div className="mw-enq-accept-grid">
        {mode === "pickup" ? (
          <label className="mw-dealer-field">
            <span>Pickup employee</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              data-testid="enquiry-employee"
            >
              {WORKSHOP_TEAM.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role} · {member.mobile}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mw-enq-visit">
            <span>Workshop</span>
            <strong>{session.business}</strong>
            <small>
              {session.city} · {session.mobile}
            </small>
          </div>
        )}

        <label className="mw-dealer-field">
          <span>Note to customer (optional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Pickup in 30 minutes · bring RC and insurance"
            data-testid="enquiry-note"
          />
        </label>
      </div>

      <div className="mw-enq-source">
        <UserRound size={14} />
        <span>
          {mode === "pickup"
            ? `Pickup from ${enquiry.location}. Call the customer before leaving.`
            : `Ask ${enquiry.customerName} to visit ${session.business}, ${session.city}.`}
        </span>
      </div>

      <button
        type="button"
        className="mw-dealer-btn is-primary"
        onClick={() =>
          run(
            acceptEnquiry({
              partnerId: session.partnerId,
              workshopName: session.business,
              workshopMobile: session.mobile,
              enquiryId: enquiry.id,
              mode,
              employeeId: mode === "pickup" ? employeeId : undefined,
              note,
            }),
            mode === "pickup"
              ? "Enquiry accepted and pickup assigned."
              : "Enquiry accepted — customer asked to visit the workshop.",
          )
        }
        data-testid="enquiry-accept"
      >
        <CheckCircle2 size={15} /> Accept &amp; assign
      </button>
    </div>
  );
}

function ChecklistBuilder({
  enquiry,
  session,
  run,
  onDone,
}: {
  enquiry: WorkshopEnquiry;
  session: PartnerSession;
  run: (result: EnquiryResult, message: string) => void;
  onDone: (message: string) => void;
}) {
  const [repairName, setRepairName] = useState("");
  const [repairQty, setRepairQty] = useState("1");
  const [repairCost, setRepairCost] = useState("");
  const [partId, setPartId] = useState(MW_AUTO_PARTS[0]?.id ?? "");
  const [partQty, setPartQty] = useState("1");
  const [discount, setDiscount] = useState(String(enquiry.checklist.discount));
  const [notes, setNotes] = useState(enquiry.checklist.notes);
  const totals = estimateTotals(enquiry);

  const addRepair = () => {
    const result = addRepairItem(session.partnerId, enquiry.id, {
      name: repairName,
      qty: Number(repairQty),
      cost: Number(repairCost),
    });
    if (result.ok) {
      setRepairName("");
      setRepairQty("1");
      setRepairCost("");
      onDone("Repair item added to the checklist.");
      return;
    }
    run(result, "");
  };

  const addReplace = () => {
    const result = addReplaceItem(session.partnerId, enquiry.id, {
      partId,
      qty: Number(partQty),
    });
    if (result.ok) {
      setPartQty("1");
      onDone("MW Auto Parts replacement added.");
      return;
    }
    run(result, "");
  };

  return (
    <div className="mw-enq-checklist" data-testid="enquiry-checklist">
      <div className="mw-enq-section-head">
        <div>
          <span className="mw-enq-section-kicker">Digital checklist &amp; estimate</span>
          <h3>Build the final estimate</h3>
        </div>
        {enquiry.checklist.sentAt ? (
          <span className="mw-dealer-chip is-ready">
            Sent {relativeTime(enquiry.checklist.sentAt)}
          </span>
        ) : null}
      </div>

      <div className="mw-enq-estimate-grid">
        <div className="mw-partner-block">
          <h3>
            <Wrench size={14} /> Repair items <small>(labour)</small>
          </h3>
          <p className="mw-dealer-field-hint">
            Denting, painting, mechanical and electrical work. The discount applies to this labour
            subtotal only.
          </p>

          {enquiry.checklist.repairItems.length === 0 ? (
            <p className="mw-dealer-empty">No repair items yet.</p>
          ) : (
            <div className="mw-dealer-tablewrap">
              <table className="mw-dealer-table mw-partner-mini-table">
                <thead>
                  <tr>
                    <th scope="col">Work</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Cost</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {enquiry.checklist.repairItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td className="is-num">{rupees(item.qty * item.cost)}</td>
                      <td>
                        <button
                          type="button"
                          className="mw-dealer-btn is-small is-danger"
                          aria-label={`Remove ${item.name}`}
                          onClick={() =>
                            run(
                              removeEnquiryLine(session.partnerId, enquiry.id, "repair", item.id),
                              "Repair item removed.",
                            )
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mw-enq-line-form">
            <input
              value={repairName}
              onChange={(event) => setRepairName(event.target.value)}
              placeholder="e.g. Denting on rear door"
              aria-label="Repair item"
              data-testid="enquiry-repair-name"
            />
            <input
              value={repairQty}
              onChange={(event) => setRepairQty(event.target.value)}
              inputMode="numeric"
              placeholder="Qty"
              aria-label="Repair quantity"
            />
            <input
              value={repairCost}
              onChange={(event) => setRepairCost(event.target.value)}
              inputMode="numeric"
              placeholder="Labour ₹"
              aria-label="Repair labour cost"
              data-testid="enquiry-repair-cost"
            />
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={addRepair}
              data-testid="enquiry-repair-add"
            >
              <Plus size={13} /> Add repair
            </button>
          </div>
        </div>

        <div className="mw-partner-block">
          <h3>
            <Package size={14} /> Replace with MW Auto Parts
          </h3>
          <p className="mw-dealer-field-hint">
            Replacement parts are pulled from the MW Auto Parts shelf with their catalogue price.
          </p>

          {enquiry.checklist.replaceItems.length === 0 ? (
            <p className="mw-dealer-empty">No replacement parts yet.</p>
          ) : (
            <div className="mw-dealer-tablewrap">
              <table className="mw-dealer-table mw-partner-mini-table">
                <thead>
                  <tr>
                    <th scope="col">Part</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Cost</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {enquiry.checklist.replaceItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td className="is-num">{rupees(item.qty * item.cost)}</td>
                      <td>
                        <button
                          type="button"
                          className="mw-dealer-btn is-small is-danger"
                          aria-label={`Remove ${item.name}`}
                          onClick={() =>
                            run(
                              removeEnquiryLine(session.partnerId, enquiry.id, "replace", item.id),
                              "Replacement part removed.",
                            )
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mw-enq-line-form">
            <select
              value={partId}
              onChange={(event) => setPartId(event.target.value)}
              aria-label="MW Auto Parts replacement"
              data-testid="enquiry-part"
            >
              {MW_AUTO_PARTS.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name} · {rupees(part.price)}
                </option>
              ))}
            </select>
            <input
              value={partQty}
              onChange={(event) => setPartQty(event.target.value)}
              inputMode="numeric"
              placeholder="Qty"
              aria-label="Replacement quantity"
            />
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={addReplace}
              data-testid="enquiry-part-add"
            >
              <Plus size={13} /> Add part
            </button>
          </div>
        </div>
      </div>

      <div className="mw-enq-estimate-bottom">
        <div className="mw-partner-block">
          <h3>Discount &amp; notes</h3>
          <label className="mw-dealer-field">
            <span>Discount on labour (₹)</span>
            <div className="mw-enq-discount">
              <input
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                inputMode="numeric"
                aria-label="Discount on labour"
                data-testid="enquiry-discount"
              />
              <button
                type="button"
                className="mw-dealer-btn is-small"
                onClick={() =>
                  run(
                    setEnquiryDiscount(session.partnerId, enquiry.id, Number(discount)),
                    "Labour discount saved.",
                  )
                }
                data-testid="enquiry-discount-save"
              >
                Apply discount
              </button>
            </div>
            <small className="mw-dealer-field-hint">
              Maximum {rupees(totals.labour)} — discount cannot be applied to parts.
            </small>
          </label>

          <label className="mw-dealer-field">
            <span>Estimate notes for the customer</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={600}
              placeholder="Parts availability, delivery time, warranty…"
              data-testid="enquiry-notes"
            />
          </label>
          <button
            type="button"
            className="mw-dealer-btn is-small"
            onClick={() =>
              run(setEnquiryNotes(session.partnerId, enquiry.id, notes), "Estimate notes saved.")
            }
          >
            Save notes
          </button>
        </div>

        <div className="mw-enq-total" data-testid="enquiry-totals">
          <span className="mw-enq-section-kicker">Final estimate</span>
          <dl>
            <div>
              <dt>Repair / labour</dt>
              <dd>{rupees(totals.labour)}</dd>
            </div>
            <div>
              <dt>MW Auto Parts</dt>
              <dd>{rupees(totals.parts)}</dd>
            </div>
            <div className="is-discount">
              <dt>Labour discount</dt>
              <dd>− {rupees(totals.discount)}</dd>
            </div>
            <div className="is-total">
              <dt>Total payable</dt>
              <dd>{rupees(totals.total)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="mw-dealer-btn is-primary"
            onClick={() =>
              run(
                sendEstimate(session.partnerId, enquiry.id),
                "Final estimate sent to the customer's dashboard.",
              )
            }
            data-testid="enquiry-send-estimate"
          >
            <Send size={15} />
            {enquiry.checklist.sentAt ? "Resend updated estimate" : "Send estimate to customer"}
          </button>
          <p className="mw-dealer-field-hint">
            The customer sees every line, the labour discount and the final total on Track Service
            and in My Requests.
          </p>
        </div>
      </div>
    </div>
  );
}
