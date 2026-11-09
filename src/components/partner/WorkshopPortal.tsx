import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Gauge,
  Inbox,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";

import { PartnerShell, type PartnerTab } from "@/components/partner/PartnerShell";
import { WorkshopEnquiries } from "@/components/partner/WorkshopEnquiries";
import { relativeTime, rupees, shortDate } from "@/lib/dealer-format";
import {
  addJobNote,
  addJobPart,
  JOB_STATUSES,
  jobPartsCost,
  partnerJobs,
  removeJobPart,
  seedPartnerData,
  setJobEstimate,
  updateJobStatus,
  type JobCard,
  type JobStatus,
} from "@/lib/partner-data";
import type { PartnerSession } from "@/lib/partner-session";
import { WORKSHOP_STATUS_LABEL, workshopEnquiries } from "@/lib/workshop-enquiries";

const JOB_CHIP: Record<JobStatus, string> = {
  Pending: "is-pending",
  "In Progress": "is-progress",
  "Waiting for Parts": "is-parts",
  "Ready for Delivery": "is-ready",
  Delivered: "is-delivered",
};

const TABS: PartnerTab[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "enquiries", label: "Service Enquiries", icon: Inbox },
  { id: "jobs", label: "Job Cards", icon: ClipboardList },
  { id: "notes", label: "Workshop Notes", icon: Wrench },
];

/**
 * Workshop desk: every service booking assigned to this workshop, with the job
 * card status flow, mechanic notes, parts used and the estimated cost.
 */
export function WorkshopPortal({ session }: { session: PartnerSession }) {
  const [tab, setTab] = useState("overview");
  const [version, setVersion] = useState(0);
  const [enquiryVersion, setEnquiryVersion] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedPartnerData({ partnerId: session.partnerId, type: session.type });
    setSeeded(true);
    setSelectedId(null);
    setFlash(null);
    setError(null);
  }, [session.partnerId, session.type]);

  const jobs = useMemo(() => {
    if (!seeded) return [];
    return partnerJobs(session.partnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.partnerId, version, seeded]);

  const enquiries = useMemo(
    () => workshopEnquiries(session.partnerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.partnerId, enquiryVersion],
  );
  const newEnquiries = enquiries.filter((enquiry) => enquiry.status === "New").length;
  const tabs = TABS.map((item) =>
    item.id === "enquiries" ? { ...item, count: newEnquiries } : item,
  );

  const selected = jobs.find((job) => job.id === selectedId) ?? null;
  const open = jobs.filter((job) => job.status !== "Delivered");
  const waiting = jobs.filter((job) => job.status === "Waiting for Parts");
  const ready = jobs.filter((job) => job.status === "Ready for Delivery");
  const serviceJobs = enquiries.filter(
    (enquiry) =>
      enquiry.payment.status === "Paid" ||
      enquiry.status === "Ready for Delivery" ||
      enquiry.status === "Delivered" ||
      enquiry.status === "Completed",
  );
  const serviceOpen = serviceJobs.filter(
    (enquiry) => enquiry.status !== "Delivered" && enquiry.status !== "Completed",
  ).length;
  const serviceReady = enquiries.filter(
    (enquiry) => enquiry.status === "Ready for Delivery",
  ).length;
  const serviceCompleted = enquiries.filter(
    (enquiry) => enquiry.status === "Delivered" || enquiry.status === "Completed",
  ).length;

  const visible = jobs.filter((job) => {
    if (filter !== "all" && job.status !== filter) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [
      job.id,
      job.bookingRef,
      job.customerName,
      job.mobile,
      job.vehicleNumber,
      job.serviceType,
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

  return (
    <PartnerShell session={session} tabs={tabs} active={tab} onTab={setTab}>
      {flash ? (
        <p className="mw-dealer-flash" role="status" data-testid="workshop-flash">
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
              <h1>Workshop overview</h1>
              <p>
                Service bookings assigned to {session.business}. Move a job card through the bay and
                the customer sees the latest stage on Track Service.
              </p>
            </div>
          </div>

          <section className="mw-dealer-kpis">
            <article className="mw-dealer-kpi is-hero">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <ClipboardList size={16} />
                </span>
                <span className="mw-dealer-kpi-label">Open job cards</span>
              </header>
              <strong className="mw-dealer-kpi-value">{open.length + serviceOpen}</strong>
              <footer>Job cards and paid service jobs still in the workshop.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <Wrench size={16} />
                </span>
                <span className="mw-dealer-kpi-label">On the floor</span>
              </header>
              <strong className="mw-dealer-kpi-value">
                {jobs.filter((job) => job.status === "In Progress").length}
              </strong>
              <footer>Work actively being done in the workshop.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <Package size={16} />
                </span>
                <span className="mw-dealer-kpi-label">Waiting for parts</span>
              </header>
              <strong className="mw-dealer-kpi-value">{waiting.length}</strong>
              <footer>Blocked until the parts order arrives.</footer>
            </article>
            <article className="mw-dealer-kpi">
              <header>
                <span className="mw-dealer-kpi-icon">
                  <CheckCircle2 size={16} />
                </span>
                <span className="mw-dealer-kpi-label">Ready for delivery</span>
              </header>
              <strong className="mw-dealer-kpi-value">{ready.length + serviceReady}</strong>
              <footer>Work complete and waiting for customer handover.</footer>
            </article>
          </section>

          {serviceJobs.length > 0 ? (
            <section className="mw-dealer-panel is-wide mw-enq-dash">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <Truck size={15} /> Service delivery jobs
                  </h2>
                  <p>
                    Paid enquiries raised from Track Service. Parts tracking, final OTP handover and
                    completed jobs all appear here.
                  </p>
                </div>
                <div className="mw-dealer-actions">
                  <span className="mw-dealer-chip is-delivered">{serviceCompleted} completed</span>
                  <button
                    type="button"
                    className="mw-dealer-btn is-small"
                    onClick={() => setTab("enquiries")}
                  >
                    Open service enquiries
                  </button>
                </div>
              </div>
              <ul className="mw-enq-dash-list" data-testid="workshop-service-jobs">
                {serviceJobs.map((enquiry) => (
                  <li key={enquiry.id}>
                    <div className="mw-enq-dash-main">
                      <strong>
                        {enquiry.vehicleNumber} · {enquiry.vehicle}
                      </strong>
                      <span>
                        {enquiry.customerName} · {enquiry.serviceType} · {enquiry.id}
                      </span>
                    </div>
                    <span
                      className={`mw-dealer-chip ${
                        enquiry.status === "Delivered" || enquiry.status === "Completed"
                          ? "is-delivered"
                          : enquiry.status === "Ready for Delivery"
                            ? "is-ready"
                            : "is-progress"
                      }`}
                    >
                      {WORKSHOP_STATUS_LABEL[enquiry.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mw-dealer-panels">
            <article className="mw-dealer-panel is-wide">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <Wrench size={15} /> Active job cards
                  </h2>
                  <p>Open a job card to update its stage, add parts and write mechanic notes.</p>
                </div>
                <button
                  type="button"
                  className="mw-dealer-btn is-small"
                  onClick={() => setTab("jobs")}
                >
                  All job cards
                </button>
              </div>

              {open.length === 0 ? (
                <p className="mw-dealer-empty">No open job cards right now.</p>
              ) : (
                <ul className="mw-partner-joblist">
                  {open.map((job) => (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(job.id);
                          setTab("jobs");
                        }}
                        data-testid={`workshop-open-${job.id}`}
                      >
                        <span className="mw-partner-joblist-lead">
                          <strong>{job.vehicle}</strong>
                          <span>
                            {job.customerName} · {job.vehicleNumber} · {job.serviceType}
                          </span>
                        </span>
                        <span className="mw-partner-joblist-meta">
                          <span className={`mw-dealer-chip ${JOB_CHIP[job.status]}`}>
                            {job.status}
                          </span>
                          <span>{relativeTime(job.updatedAt)}</span>
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
                    <Clock size={15} /> Today&apos;s schedule
                  </h2>
                  <p>Vehicles booked for today or tomorrow.</p>
                </div>
              </div>
              <ul className="mw-dealer-feed">
                {jobs
                  .filter((job) => {
                    const start = new Date(job.scheduledFor).getTime();
                    return (
                      start >= Date.now() - 12 * 60 * 60 * 1000 &&
                      start <= Date.now() + 36 * 60 * 60 * 1000
                    );
                  })
                  .map((job) => (
                    <li key={job.id}>
                      <strong>{job.vehicleNumber}</strong>
                      <span className="is-meta">
                        {shortDate(job.scheduledFor)} · {job.serviceType}
                      </span>
                    </li>
                  ))}
                {jobs.length === 0 ? <li>No bookings assigned yet.</li> : null}
              </ul>
            </article>

            <article className="mw-dealer-panel">
              <div className="mw-dealer-panel-head">
                <div>
                  <h2>
                    <CheckCircle2 size={15} /> Recently delivered
                  </h2>
                  <p>Handed back to the customer.</p>
                </div>
              </div>
              <ul className="mw-dealer-feed">
                {jobs
                  .filter((job) => job.status === "Delivered")
                  .slice(0, 4)
                  .map((job) => (
                    <li key={job.id}>
                      <div>
                        <strong>{job.customerName}</strong>
                        <div className="is-meta">
                          {job.vehicleNumber} · {job.serviceType}
                        </div>
                      </div>
                      <span className="is-meta">{rupees(job.estimatedCost)}</span>
                    </li>
                  ))}
                {jobs.every((job) => job.status !== "Delivered") ? (
                  <li>Nothing delivered yet.</li>
                ) : null}
              </ul>
            </article>
          </section>
        </>
      ) : null}

      {tab === "enquiries" ? (
        <WorkshopEnquiries
          session={session}
          onChanged={() => setEnquiryVersion((value) => value + 1)}
        />
      ) : null}

      {tab === "jobs" ? (
        <>
          <div className="mw-dealer-head">
            <div>
              <h1>Job card management</h1>
              <p>
                {jobs.length} service booking{jobs.length === 1 ? "" : "s"} assigned to this
                workshop. Statuses flow Pending → In Progress → Waiting for Parts → Ready for
                Delivery → Delivered.
              </p>
            </div>
            <div className="mw-partner-toolbar">
              <label className="mw-partner-search">
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">Search job cards</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search vehicle, customer, job…"
                  data-testid="workshop-job-search"
                />
              </label>
              <label className="mw-admin-select">
                <span className="sr-only">Filter by status</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as JobStatus | "all")}
                  data-testid="workshop-job-filter"
                >
                  <option value="all">All statuses</option>
                  {JOB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <section className="mw-dealer-panel">
            {visible.length === 0 ? (
              <p className="mw-dealer-empty">No job cards match this filter.</p>
            ) : (
              <div className="mw-dealer-tablewrap">
                <table className="mw-dealer-table" data-testid="workshop-job-table">
                  <thead>
                    <tr>
                      <th scope="col">Job card</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Service</th>
                      <th scope="col">Status</th>
                      <th scope="col">Estimate</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((job) => (
                      <tr key={job.id} data-testid={`workshop-job-row-${job.id}`}>
                        <td>
                          <strong>{job.id}</strong>
                          <div className="is-muted">{job.bookingRef}</div>
                        </td>
                        <td>
                          <strong>{job.customerName}</strong>
                          <div className="is-muted">{job.mobile}</div>
                        </td>
                        <td>
                          <strong>{job.vehicleNumber}</strong>
                          <div className="is-muted">{job.vehicle}</div>
                        </td>
                        <td>{job.serviceType}</td>
                        <td>
                          <span className={`mw-dealer-chip ${JOB_CHIP[job.status]}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="is-num">{rupees(job.estimatedCost)}</td>
                        <td>
                          <button
                            type="button"
                            className="mw-dealer-btn is-small"
                            onClick={() => setSelectedId(job.id)}
                            data-testid={`workshop-open-job-${job.id}`}
                          >
                            {selectedId === job.id ? "Editing" : "Open"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selected ? (
            <JobDetail
              key={selected.id}
              job={selected}
              author={session.name}
              onChanged={changed}
              onError={setError}
            />
          ) : (
            <p className="mw-dealer-scope-note">
              <ClipboardList size={15} />
              <span>
                Select <strong>Open</strong> on a job card to update its status, add the parts used,
                write a mechanic note and set the estimated cost.
              </span>
            </p>
          )}
        </>
      ) : null}

      {tab === "notes" ? (
        <>
          <div className="mw-dealer-head">
            <div>
              <h1>Workshop notes</h1>
              <p>Every mechanic note across the job cards assigned to this workshop.</p>
            </div>
          </div>
          <section className="mw-dealer-panel">
            {jobs.every((job) => job.notes.length === 0) ? (
              <p className="mw-dealer-empty">No mechanic notes yet.</p>
            ) : (
              <ul className="mw-partner-notes is-wide">
                {jobs.flatMap((job) =>
                  job.notes.map((item) => (
                    <li key={`${job.id}-${item.id}`}>
                      <div className="mw-partner-note-head">
                        <strong>{job.id}</strong>
                        <span>
                          {job.vehicleNumber} · {relativeTime(item.at)}
                        </span>
                      </div>
                      <p>{item.text}</p>
                      <small>{item.author}</small>
                    </li>
                  )),
                )}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PartnerShell>
  );
}

function JobDetail({
  job,
  author,
  onChanged,
  onError,
}: {
  job: JobCard;
  author: string;
  onChanged: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [note, setNote] = useState("");
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partCost, setPartCost] = useState("");
  const [estimate, setEstimate] = useState(String(job.estimatedCost));
  const [error, setError] = useState<string | null>(null);

  const partsCost = jobPartsCost(job);

  const run = (result: { ok: boolean; error?: string }, message: string) => {
    if (!result.ok) {
      setError(result.error ?? "The change could not be saved.");
      onError(result.error ?? null);
      return;
    }
    setError(null);
    onChanged(message);
  };

  return (
    <section
      className="mw-dealer-panel is-wide mw-partner-detail"
      data-testid={`workshop-detail-${job.id}`}
    >
      <div className="mw-dealer-panel-head">
        <div>
          <h2>
            <ClipboardList size={15} /> Job card {job.id}
          </h2>
          <p>
            {job.bookingRef} · scheduled {shortDate(job.scheduledFor)} · updated{" "}
            {relativeTime(job.updatedAt)}
          </p>
        </div>
        <span className={`mw-dealer-chip ${JOB_CHIP[job.status]}`}>{job.status}</span>
      </div>

      {error ? (
        <p className="mw-dealer-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mw-partner-facts">
        <div>
          <span>Customer</span>
          <strong>{job.customerName}</strong>
        </div>
        <div>
          <span>Mobile</span>
          <strong>
            <a href={`tel:${job.mobile}`} className="mw-partner-tel">
              <Phone size={13} /> {job.mobile}
            </a>
          </strong>
        </div>
        <div>
          <span>Vehicle number</span>
          <strong className="mw-partner-plate">{job.vehicleNumber}</strong>
        </div>
        <div>
          <span>Vehicle</span>
          <strong>{job.vehicle}</strong>
        </div>
        <div>
          <span>Service</span>
          <strong>{job.serviceType}</strong>
        </div>
        <div>
          <span>Parts cost</span>
          <strong>{rupees(partsCost)}</strong>
        </div>
      </div>

      <div className="mw-partner-detail-grid">
        <div className="mw-partner-block">
          <h3>Update status</h3>
          <div className="mw-partner-inline">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as JobStatus)}
              aria-label="Job card status"
              data-testid="workshop-status-select"
            >
              {JOB_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mw-dealer-btn is-primary is-small"
              onClick={() =>
                run(updateJobStatus(job.partnerId, job.id, status), `Status set to ${status}.`)
              }
              data-testid="workshop-status-save"
            >
              Update status
            </button>
          </div>

          <h3>Estimated cost</h3>
          <div className="mw-partner-inline">
            <input
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              inputMode="numeric"
              aria-label="Estimated cost"
              data-testid="workshop-estimate"
            />
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={() =>
                run(
                  setJobEstimate(job.partnerId, job.id, Number(estimate)),
                  "Estimated cost saved.",
                )
              }
            >
              Save estimate
            </button>
          </div>
          <p className="mw-dealer-field-hint">
            Parts {rupees(partsCost)} · estimate {rupees(job.estimatedCost)} · labour{" "}
            {rupees(Math.max(0, job.estimatedCost - partsCost))}
          </p>

          <h3>Status timeline</h3>
          <ol className="mw-partner-timeline">
            {job.timeline.map((entry, index) => (
              <li key={`${entry.status}-${index}`}>
                <span className={`mw-dealer-chip ${JOB_CHIP[entry.status]}`}>{entry.status}</span>
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
          <h3>Parts used</h3>
          {job.parts.length === 0 ? (
            <p className="mw-dealer-field-hint">No parts recorded yet.</p>
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
                  {job.parts.map((item) => (
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
                            run(removeJobPart(job.partnerId, job.id, item.id), "Part removed.")
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

          <div className="mw-partner-part-form">
            <input
              value={partName}
              onChange={(event) => setPartName(event.target.value)}
              placeholder="Part name"
              aria-label="Part name"
              data-testid="workshop-part-name"
            />
            <input
              value={partQty}
              onChange={(event) => setPartQty(event.target.value)}
              placeholder="Qty"
              inputMode="numeric"
              aria-label="Part quantity"
            />
            <input
              value={partCost}
              onChange={(event) => setPartCost(event.target.value)}
              placeholder="Cost ₹"
              inputMode="numeric"
              aria-label="Part cost"
            />
            <button
              type="button"
              className="mw-dealer-btn is-small"
              onClick={() => {
                const result = addJobPart(job.partnerId, job.id, {
                  name: partName,
                  qty: Number(partQty),
                  cost: Number(partCost),
                });
                if (result.ok) {
                  setPartName("");
                  setPartQty("1");
                  setPartCost("");
                }
                run(result, "Part added to the job card.");
              }}
              data-testid="workshop-part-add"
            >
              <Plus size={13} /> Add part
            </button>
          </div>

          <h3>Mechanic notes</h3>
          <div className="mw-partner-note-form">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="What did the mechanic find or do?"
              aria-label="Mechanic note"
              data-testid="workshop-note-input"
            />
            <button
              type="button"
              className="mw-dealer-btn is-primary is-small"
              onClick={() => {
                const result = addJobNote(job.partnerId, job.id, note, author);
                if (result.ok) setNote("");
                run(result, "Mechanic note added.");
              }}
              data-testid="workshop-note-add"
            >
              Add note
            </button>
          </div>

          {job.notes.length === 0 ? (
            <p className="mw-dealer-field-hint">No notes on this job card yet.</p>
          ) : (
            <ul className="mw-partner-notes">
              {job.notes.map((item) => (
                <li key={item.id}>
                  <div className="mw-partner-note-head">
                    <strong>{item.author}</strong>
                    <span>{relativeTime(item.at)}</span>
                  </div>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
