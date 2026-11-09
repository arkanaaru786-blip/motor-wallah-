import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  MessageCircle,
  Phone,
  Radio,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { rupees } from "@/lib/dealer-format";
import { readLeadQueue } from "@/lib/leads";
import {
  isTrackingId,
  liveStageIndex,
  mockStageIndex,
  SERVICE_STATUSES,
} from "@/lib/service-tracking";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";
import {
  CUSTOMER_STATUS_LABEL,
  enquiryStageIndex,
  estimateTotals,
  findEnquiryByTracking,
  WORKSHOP_DEPARTMENTS,
  type WorkshopEnquiry,
} from "@/lib/workshop-enquiries";

const TITLE = "Track Your Service — Live Status | Motor Wallah";
const DESCRIPTION =
  "Enter your Motor Wallah Tracking ID and mobile number to see where your vehicle service is: pending, picked up, in service, ready or delivered.";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>): TrackSearch => {
    const id = search["id"];
    return { id: typeof id === "string" && isTrackingId(id) ? id.trim() : undefined };
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type TrackSearch = {
  /** ?id=MW-SRV-12345 prefills the form from the success screen. */
  id?: string | undefined;
};

/** Date-only values are parsed as local calendar dates, never UTC midnight. */
const dateOnlyLabel = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

type TrackResult = {
  trackingId: string;
  stage: number;
  /** "booking" = found this device's own lead; "mock" = demo data. */
  source: "booking" | "mock";
  booking: { category: string; serviceType: string; vehicle: string; slot: string } | null;
};

function Page() {
  const { id } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [enquiry, setEnquiry] = useState<WorkshopEnquiry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const createdAtRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Keep the submitted Tracking ID in sync with ?id= when navigating back.
  const [trackingId, setTrackingId] = useState(id ?? "");
  useEffect(() => {
    if (id) setTrackingId(id);
  }, [id]);

  // Live tick: while a real booking's result is shown, recompute the mock
  // timeline every few seconds so the bar moves forward on its own.
  useEffect(() => {
    if (!result || result.source !== "booking") return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setEnquiry(findEnquiryByTracking(result.trackingId));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [result]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const idValue = String(data.get("trackingId") ?? "")
      .trim()
      .toUpperCase();
    const mobile = String(data.get("mobile") ?? "").trim();

    if (!isTrackingId(idValue)) {
      setError("Enter a valid Tracking ID in the format MW-SRV-12345.");
      setResult(null);
      setEnquiry(null);
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) {
      setError("Please enter the 10-digit mobile number used for the booking.");
      setResult(null);
      setEnquiry(null);
      return;
    }

    // Look up this device's own booking/enquiry first (Tracking ID + mobile).
    const lead = readLeadQueue()
      .filter((l) => l.type === "service_booking" || l.type === "workshop_enquiry")
      .find((l) => l.fields?.["trackingId"] === idValue);
    const workshopEnquiry = findEnquiryByTracking(idValue);
    const recordMobile = workshopEnquiry?.mobile ?? lead?.mobile;

    setError(null);
    if (recordMobile && recordMobile.replace(/\s+/g, "") !== mobile.replace(/\s+/g, "")) {
      setError("No service found for this Tracking ID and Mobile Number. Please check both.");
      setResult(null);
      setEnquiry(null);
      return;
    }

    if (workshopEnquiry || lead) {
      const createdAt = workshopEnquiry?.createdAt ?? lead?.createdAt ?? new Date().toISOString();
      createdAtRef.current = Date.parse(createdAt);
      const f = lead?.fields ?? {};
      const vehicle =
        workshopEnquiry?.vehicle ??
        `${f["year"] ?? ""} ${f["brand"] ?? ""} ${f["model"] ?? ""}`.trim();
      setEnquiry(workshopEnquiry);
      setResult({
        trackingId: idValue,
        stage: workshopEnquiry
          ? enquiryStageIndex(workshopEnquiry.status)
          : liveStageIndex(Date.parse(createdAt), Date.now()),
        source: "booking",
        booking: {
          category: workshopEnquiry?.category ?? f["category"] ?? "Vehicle",
          serviceType: workshopEnquiry?.serviceType ?? f["serviceType"] ?? "Service",
          vehicle: vehicle || "Your vehicle",
          slot: workshopEnquiry
            ? `${dateOnlyLabel(workshopEnquiry.preferredDate)} · ${workshopEnquiry.preferredTime}`
            : `${dateOnlyLabel(f["date"] ?? "")} ${f["time"] ?? ""}`.trim() || "To be confirmed",
        },
      });
      setNow(Date.now());
    } else {
      // No local record — mock demo status for any well-formed ID.
      createdAtRef.current = null;
      setEnquiry(null);
      setResult({
        trackingId: idValue,
        stage: mockStageIndex(idValue),
        source: "mock",
        booking: null,
      });
    }

    window.setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  // Recompute a real booking's stage on every tick (mock timeline).
  const stage = enquiry
    ? enquiryStageIndex(enquiry.status)
    : result && result.source === "booking" && createdAtRef.current !== null
      ? liveStageIndex(createdAtRef.current, now)
      : (result?.stage ?? 0);
  const current =
    SERVICE_STATUSES[Math.min(stage, SERVICE_STATUSES.length - 1)] ?? SERVICE_STATUSES[0]!;
  const progress = (stage / (SERVICE_STATUSES.length - 1)) * 100;

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to track my vehicle service.");

  return (
    <div id="top" className="mw-sell mw-trk min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Service Tracking · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Track Your <em>Service</em>
            </h1>
            <p className="mw-sell-hero-text">
              Enter the Tracking ID from your booking confirmation and the mobile number you used —
              see exactly where your vehicle is: pending, picked up, in service, ready or delivered.
            </p>
            <div className="mw-sell-hero-actions">
              <a
                className="mw-sell-ghost-btn"
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>

        {/* ---------------- Track form ---------------- */}
        <section id="track-panel" className="mw-sell-form-section" aria-labelledby="track-title">
          <div className="home-container">
            <div className="mw-sell-form-head">
              <Link className="mw-sell-back" to="/services">
                <ArrowLeft size={14} /> Back to Service
              </Link>
              <span className="mw-sell-chip">
                <Radio size={16} aria-hidden="true" />
                <span>
                  Live Tracking <small>MW-SRV-#####</small>
                </span>
              </span>
            </div>

            <form className="mw-sell-form mw-trk-form" onSubmit={onSubmit}>
              <h2 id="track-title" className="mw-sell-form-title">
                Track <span>your booking</span>
              </h2>
              <p className="mw-sell-form-sub">
                Use the Tracking ID shown on your booking success screen. Fields marked * are
                required.
              </p>

              <div className="mw-sell-fields">
                <label className="mw-sell-field">
                  <span className="mw-sell-field-label">Tracking ID *</span>
                  <input
                    className="mw-sell-input"
                    type="text"
                    name="trackingId"
                    required
                    maxLength={12}
                    pattern="MW-SRV-[0-9]{5}"
                    placeholder="MW-SRV-12345"
                    value={trackingId}
                    onChange={(event) => setTrackingId(event.target.value.toUpperCase())}
                    data-testid="track-id-input"
                  />
                </label>
                <label className="mw-sell-field">
                  <span className="mw-sell-field-label">Mobile Number *</span>
                  <input
                    className="mw-sell-input"
                    type="tel"
                    name="mobile"
                    required
                    maxLength={15}
                    pattern="[0-9+ ]{10,15}"
                    placeholder="10-digit mobile"
                    data-testid="track-mobile-input"
                  />
                </label>
              </div>

              {error && (
                <p className="mw-sell-error" role="alert" data-testid="track-error">
                  {error}
                </p>
              )}

              <div className="mw-sell-form-foot">
                <button type="submit" className="mw-sell-submit">
                  Track Service
                </button>
                <p className="mw-sell-form-note">
                  Statuses are simulated for this preview — connect your workshop system later to
                  make them fully live. Nothing here is visible to anyone else.
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* ---------------- Progress result ---------------- */}
        {result && (
          <section
            id="track-result"
            ref={resultRef}
            className="mw-sell-form-section"
            aria-labelledby="track-result-title"
          >
            <div className="home-container">
              <div className="mw-trk-result">
                <div className="mw-trk-head">
                  <div>
                    <p className="mw-trk-kicker">Tracking ID</p>
                    <h2 id="track-result-title" className="mw-trk-id">
                      {result.trackingId}
                    </h2>
                  </div>
                  <span className="mw-trk-status-pill" data-stage={current.key}>
                    {current.label}
                  </span>
                </div>

                <p className="mw-trk-current" data-testid="track-current">
                  Current status: <strong>{current.label}</strong> — {current.text}
                </p>

                {result.source === "mock" && (
                  <p className="mw-trk-mock">
                    <MapPin size={13} aria-hidden="true" /> Sample tracking data — this device has
                    no matching booking, so a demo status is shown.
                  </p>
                )}

                <div
                  className="mw-trk-bar"
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={SERVICE_STATUSES.length}
                  aria-valuenow={stage + 1}
                  aria-label="Service progress"
                >
                  <span className="mw-trk-bar-fill" style={{ width: `${progress}%` }} />
                </div>

                <ol className="mw-trk-stages" data-testid="track-stages">
                  {SERVICE_STATUSES.map((status, index) => (
                    <li
                      key={status.key}
                      className="mw-trk-stage"
                      data-state={index < stage ? "done" : index === stage ? "current" : "next"}
                    >
                      <span className="mw-trk-dot" aria-hidden="true">
                        {index < stage ? <CheckCircle2 size={15} /> : index + 1}
                      </span>
                      <span className="mw-trk-label">{status.label}</span>
                      <span className="mw-trk-text">{status.text}</span>
                    </li>
                  ))}
                </ol>

                {result.booking && (
                  <div className="mw-trk-booking">
                    <span>{result.booking.category}</span>
                    <span>{result.booking.serviceType}</span>
                    <span>{result.booking.vehicle}</span>
                    <span>{result.booking.slot}</span>
                  </div>
                )}

                {enquiry ? <CustomerEnquiryCard enquiry={enquiry} /> : null}

                <div className="mw-trk-actions">
                  <Link className="mw-sell-ghost-btn" to="/services">
                    Book Another Service
                  </Link>
                  <a
                    className="mw-sell-ghost-btn"
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                    <Phone size={14} /> Call {PHONE_DISPLAY}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}

function CustomerEnquiryCard({ enquiry }: { enquiry: WorkshopEnquiry }) {
  const department =
    WORKSHOP_DEPARTMENTS.find((item) => item.id === enquiry.department)?.label ?? "Workshop";
  const totals = estimateTotals(enquiry);
  const sent = Boolean(enquiry.checklist.sentAt);
  const assignedPhone =
    enquiry.assignment?.mode === "pickup" ? enquiry.assignment.employeeMobile : null;
  const workshopPhone = enquiry.workshopMobile ?? enquiry.assignment?.employeeMobile ?? null;

  return (
    <section className="mw-trk-workshop" data-testid="track-enquiry">
      <div className="mw-trk-workshop-head">
        <div>
          <p className="mw-trk-kicker">Workshop update · {enquiry.id}</p>
          <h3>
            {department} · {enquiry.vehicleNumber}
          </h3>
        </div>
        <span className="mw-trk-workshop-status" data-enquiry-status={enquiry.status}>
          {CUSTOMER_STATUS_LABEL[enquiry.status]}
        </span>
      </div>

      <p className="mw-trk-workshop-copy">
        {enquiry.status === "New"
          ? "Your enquiry is waiting for a workshop to accept it. Keep this Tracking ID handy."
          : enquiry.status === "Accepted"
            ? enquiry.assignment?.mode === "pickup"
              ? `${enquiry.workshopName ?? "The workshop"} accepted the job and assigned a pickup.`
              : `${enquiry.workshopName ?? "The workshop"} accepted the job and has asked you to visit.`
            : enquiry.status === "Vehicle Received"
              ? "Your vehicle is at the workshop. The team is preparing the repair checklist and estimate."
              : enquiry.status === "Estimate Sent"
                ? "The workshop has sent your final estimate. Review the line items below."
                : enquiry.status === "Completed"
                  ? "The workshop has completed this job."
                  : "This enquiry was cancelled."}
      </p>

      <div className="mw-trk-workshop-grid">
        <div>
          <span>Service</span>
          <strong>{enquiry.serviceType}</strong>
        </div>
        <div>
          <span>Vehicle</span>
          <strong>
            {enquiry.vehicle} · {enquiry.vehicleNumber}
          </strong>
        </div>
        <div>
          <span>Preferred slot</span>
          <strong>
            {dateOnlyLabel(enquiry.preferredDate)} · {enquiry.preferredTime}
          </strong>
        </div>
        <div>
          <span>Workshop</span>
          <strong>{enquiry.workshopName ?? "Awaiting acceptance"}</strong>
        </div>
      </div>

      {enquiry.assignment ? (
        <div className="mw-trk-assignment" data-testid="track-assignment">
          {enquiry.assignment.mode === "pickup" ? <Truck size={17} /> : <MapPin size={17} />}
          <div>
            <strong>
              {enquiry.assignment.mode === "pickup"
                ? `Pickup by ${enquiry.assignment.employeeName ?? "workshop employee"}`
                : "Visit the workshop"}
            </strong>
            <span>
              {enquiry.assignment.mode === "pickup"
                ? `${enquiry.assignment.employeeMobile ?? ""} · ${enquiry.location}`
                : `${enquiry.workshopName ?? "Workshop"} · ${enquiry.location}`}
            </span>
            {enquiry.assignment.note ? <small>{enquiry.assignment.note}</small> : null}
          </div>
          {assignedPhone ? (
            <a href={`tel:${assignedPhone}`} className="mw-trk-call" data-testid="track-call">
              <Phone size={14} /> Call
            </a>
          ) : workshopPhone ? (
            <a href={`tel:${workshopPhone}`} className="mw-trk-call" data-testid="track-call">
              <Phone size={14} /> Call workshop
            </a>
          ) : null}
        </div>
      ) : null}

      {sent ? (
        <div className="mw-trk-estimate" data-testid="track-estimate">
          <div className="mw-trk-estimate-head">
            <span>
              <ClipboardCheck size={15} /> Final estimate
            </span>
            <strong>{rupees(totals.total)}</strong>
          </div>

          {enquiry.checklist.repairItems.length > 0 ? (
            <>
              <p className="mw-trk-estimate-label">Repair / labour</p>
              <ul>
                {enquiry.checklist.repairItems.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.name} <small>×{item.qty}</small>
                    </span>
                    <span>{rupees(item.qty * item.cost)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {enquiry.checklist.replaceItems.length > 0 ? (
            <>
              <p className="mw-trk-estimate-label">MW Auto Parts replacements</p>
              <ul>
                {enquiry.checklist.replaceItems.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.name} <small>×{item.qty}</small>
                    </span>
                    <span>{rupees(item.qty * item.cost)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <dl className="mw-trk-estimate-total">
            <div>
              <dt>Labour</dt>
              <dd>{rupees(totals.labour)}</dd>
            </div>
            <div>
              <dt>Parts</dt>
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

          {enquiry.checklist.notes ? (
            <p className="mw-trk-estimate-note">{enquiry.checklist.notes}</p>
          ) : null}
        </div>
      ) : (
        <p className="mw-trk-workshop-wait">
          <ClipboardCheck size={14} /> The checklist and final estimate will appear here once the
          workshop sends them.
        </p>
      )}

      {workshopPhone ? (
        <p className="mw-trk-workshop-call">
          Need to coordinate? Call {enquiry.workshopName ?? "the workshop"} on{" "}
          <a href={`tel:${workshopPhone}`}>
            <Phone size={13} /> {workshopPhone}
          </a>
        </p>
      ) : null}
    </section>
  );
}
