import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Radio,
  ShieldCheck,
  Truck,
  XCircle,
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
import { payPrepaid } from "@/lib/razorpay-checkout";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";
import {
  approveEnquiryEstimate,
  CUSTOMER_STATUS_LABEL,
  confirmEnquiryPayment,
  enquiryStageIndex,
  estimateTotals,
  findEnquiryByTracking,
  MOCK_ENQUIRY_OTP,
  MOCK_FINAL_OTP,
  PREPAID_ONLY_NOTICE,
  rejectEnquiryEstimate,
  shareFinalOtp,
  VEHICLE_READY_NOTICE,
  WORKSHOP_DEPARTMENTS,
  type WorkshopEnquiry,
} from "@/lib/workshop-enquiries";
import {
  findDisputeForEnquiry,
  reportWorkshop,
  type WorkshopDispute,
} from "@/lib/workshop-disputes";

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

                {enquiry ? (
                  <CustomerEnquiryCard
                    enquiry={enquiry}
                    onChanged={() =>
                      setEnquiry(result ? findEnquiryByTracking(result.trackingId) : null)
                    }
                  />
                ) : null}

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

function CustomerEnquiryCard({
  enquiry,
  onChanged,
}: {
  enquiry: WorkshopEnquiry;
  onChanged: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [previewCheckout, setPreviewCheckout] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [sharingOtp, setSharingOtp] = useState(false);
  const [dispute, setDispute] = useState<WorkshopDispute | null>(() =>
    findDisputeForEnquiry(enquiry.id),
  );
  const department =
    WORKSHOP_DEPARTMENTS.find((item) => item.id === enquiry.department)?.label ?? "Workshop";
  const totals = estimateTotals(enquiry);
  const sent = Boolean(enquiry.checklist.sentAt);
  const lockedAmount = enquiry.approval.lockedTotal ?? totals.total;
  const assignedPhone =
    enquiry.assignment?.mode === "pickup" ? enquiry.assignment.employeeMobile : null;
  const workshopPhone = enquiry.workshopMobile ?? enquiry.assignment?.employeeMobile ?? null;

  const applyResult = (result: { ok: true } | { ok: false; error: string }, message: string) => {
    if (!result.ok) {
      setError(result.error);
      setFlash(null);
      return;
    }
    onChanged();
    setError(null);
    setFlash(message);
  };

  const approve = () =>
    applyResult(
      approveEnquiryEstimate(enquiry.id, enquiry.mobile),
      "Approved. Your OTP is ready to share with the workshop.",
    );

  const reject = () =>
    applyResult(
      rejectEnquiryEstimate(enquiry.id, enquiry.mobile),
      "Estimate rejected. The workshop has been informed.",
    );

  const pay = async () => {
    setError(null);
    setFlash(null);
    setPaying(true);
    const payment = await payPrepaid({
      amount: lockedAmount,
      receipt: enquiry.trackingId,
      description: `Workshop estimate · ${enquiry.vehicleNumber}`,
      customer: {
        name: enquiry.customerName,
        mobile: enquiry.mobile,
        city: enquiry.location,
      },
      notes: { enquiryId: enquiry.id, trackingId: enquiry.trackingId },
    });
    setPaying(false);

    if (payment.status === "cancelled") {
      setError("Payment cancelled — nothing was charged. You can retry when ready.");
      return;
    }
    if (payment.status === "unavailable") {
      // The dev preview has no Razorpay secret. Keep the real gateway as the
      // first choice, and offer a no-money preview checkout only while running
      // the Vite development server. A production build never shows this.
      if (import.meta.env.DEV && /not switched on/i.test(payment.message)) {
        setPreviewCheckout(true);
        setError(null);
        return;
      }
      setError(payment.message);
      return;
    }

    const saved = confirmEnquiryPayment(enquiry.id, enquiry.mobile, {
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      amount: payment.amount,
    });
    if (!saved.ok) {
      setError(`${saved.error} Razorpay payment ID: ${payment.paymentId}`);
      return;
    }
    onChanged();
    setFlash("Payment successful. Your vehicle is now received for service.");
  };

  const completePreviewPayment = () => {
    const stamp = Date.now();
    const saved = confirmEnquiryPayment(enquiry.id, enquiry.mobile, {
      orderId: `order_preview_${stamp}`,
      paymentId: `pay_preview_${stamp}`,
      amount: lockedAmount,
      provider: "Preview",
    });
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    setPreviewCheckout(false);
    onChanged();
    setFlash("Preview payment successful. Your vehicle is now received for service.");
  };

  const shareOtp = () => {
    setSharingOtp(true);
    const result = shareFinalOtp(enquiry.id, enquiry.mobile);
    setSharingOtp(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    applyResult(result, "Final OTP ready. Share it with the workshop after your inspection.");
  };

  const report = () => {
    setReporting(true);
    const result = reportWorkshop(enquiry.id, enquiry.mobile);
    setReporting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDispute(result.dispute);
    setError(null);
    setFlash(`Dispute ${result.dispute.id} raised with the Motor Wallah admin team.`);
  };

  return (
    <section className="mw-trk-workshop" data-testid="track-enquiry">
      {flash ? (
        <p className="mw-trk-flash" role="status" data-testid="track-flash">
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-trk-error" role="alert" data-testid="track-action-error">
          <AlertTriangle size={14} /> {error}
        </p>
      ) : null}

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
                ? "The workshop has sent your final estimate. Review the line items and approve it to continue."
                : enquiry.status === "Approved"
                  ? "You approved the estimate. Share your OTP with the workshop so they can lock the amount."
                  : enquiry.status === "Estimate Locked"
                    ? "The workshop verified your OTP. Your amount is locked — pay securely online to start the service."
                    : enquiry.status === "Paid"
                      ? "Payment received. Your vehicle is now received for service at the workshop."
                      : enquiry.status === "Ready for Delivery"
                        ? VEHICLE_READY_NOTICE
                        : enquiry.status === "Delivered"
                          ? "Your vehicle has been delivered. The workshop has completed this job."
                          : enquiry.status === "Rejected"
                            ? "You rejected this estimate. The workshop cannot start the repair."
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

          {enquiry.status === "Estimate Sent" ? (
            <div className="mw-trk-approval" data-testid="track-approval">
              <div className="mw-trk-approval-head">
                <span>Approve this estimate</span>
                <strong>{rupees(totals.total)}</strong>
              </div>
              <p>
                Approve to receive an OTP on your mobile. Share that OTP with the workshop to lock
                the amount before paying.
              </p>
              <div className="mw-trk-approval-actions">
                <button
                  type="button"
                  className="mw-trk-approve-btn"
                  onClick={approve}
                  data-testid="track-approve"
                >
                  <CheckCircle2 size={15} /> Approve &amp; Proceed
                </button>
                <button
                  type="button"
                  className="mw-trk-reject-btn"
                  onClick={reject}
                  data-testid="track-reject"
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </div>
          ) : null}

          {enquiry.status === "Approved" ? (
            <div className="mw-trk-otp" data-testid="track-otp">
              <span className="mw-trk-demo-kicker">Approval OTP sent</span>
              <p>
                Share this one-time password with {enquiry.workshopName ?? "the workshop"}. They
                will enter it in their portal to lock your estimate.
              </p>
              <strong className="mw-trk-otp-code" data-testid="track-otp-code">
                {MOCK_ENQUIRY_OTP}
              </strong>
              <small>Preview OTP — SMS delivery is simulated for this demo.</small>
            </div>
          ) : null}

          {enquiry.status === "Estimate Locked" ? (
            <div className="mw-trk-payment" data-testid="track-payment">
              <div className="mw-trk-payment-head">
                <span>
                  <CreditCard size={15} /> Razorpay secure checkout
                </span>
                <strong>{rupees(lockedAmount)}</strong>
              </div>
              <p className="mw-trk-prepaid-notice">
                <ShieldCheck size={15} /> {PREPAID_ONLY_NOTICE}
              </p>
              <button
                type="button"
                className="mw-trk-pay-btn"
                onClick={() => void pay()}
                disabled={paying}
                data-testid="track-pay"
              >
                {paying ? <Loader2 className="mw-spin" size={15} /> : <CreditCard size={15} />}
                {paying ? "Opening Razorpay…" : `Pay ${rupees(lockedAmount)} securely`}
              </button>
              <small>
                UPI, cards, net banking and wallets. Razorpay verifies the payment before the job
                starts.
              </small>

              {previewCheckout ? (
                <div className="mw-trk-preview-pay" data-testid="track-preview-checkout">
                  <div className="mw-trk-preview-head">
                    <span>Razorpay preview checkout</span>
                    <strong>{rupees(lockedAmount)}</strong>
                  </div>
                  <p className="mw-trk-preview-badge">
                    Preview mode — no real money is charged. Add RAZORPAY_KEY_SECRET to use live
                    Razorpay checkout.
                  </p>
                  <div className="mw-trk-pay-methods" aria-hidden="true">
                    <span>UPI</span>
                    <span>Card</span>
                    <span>Net banking</span>
                    <span>Wallet</span>
                  </div>
                  <button
                    type="button"
                    className="mw-trk-pay-btn"
                    onClick={completePreviewPayment}
                    data-testid="track-preview-pay"
                  >
                    <ShieldCheck size={15} /> Complete preview payment
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {enquiry.payment.status === "Paid" ? (
            <div className="mw-trk-paid" data-testid="track-paid">
              <BadgeCheck size={20} />
              <div>
                <strong>Vehicle Received for Service</strong>
                <p>
                  {rupees(enquiry.payment.amount ?? lockedAmount)}{" "}
                  {enquiry.payment.provider === "Preview"
                    ? "paid in the preview checkout (no real money charged)."
                    : "paid online via Razorpay."}{" "}
                  The workshop has been notified and your vehicle is received for service.
                </p>
                <small>
                  Payment ID <b>{enquiry.payment.paymentId}</b>
                  {enquiry.payment.paidAt
                    ? ` · ${new Date(enquiry.payment.paidAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </small>
              </div>
            </div>
          ) : null}

          {enquiry.status === "Ready for Delivery" ? (
            <div className="mw-trk-ready" data-testid="track-ready">
              <div className="mw-trk-ready-head">
                <BellRing size={20} />
                <div>
                  <strong>Inspection &amp; final handover</strong>
                  <p>{VEHICLE_READY_NOTICE}</p>
                </div>
              </div>
              {enquiry.delivery.finalOtpSentAt ? (
                <div className="mw-trk-final-otp" data-testid="track-final-otp">
                  <KeyRound size={18} />
                  <div>
                    <span>Final handover OTP</span>
                    <strong data-testid="track-final-otp-code">{MOCK_FINAL_OTP}</strong>
                    <small>
                      Share this with the workshop after your inspection. They will verify it to
                      complete the delivery.
                    </small>
                  </div>
                </div>
              ) : (
                <div className="mw-trk-inspect">
                  <label>
                    <input
                      type="checkbox"
                      checked={inspected}
                      onChange={(event) => setInspected(event.target.checked)}
                      data-testid="track-inspected"
                    />
                    <span>I have inspected the vehicle and I am ready for handover.</span>
                  </label>
                  <button
                    type="button"
                    className="mw-trk-pay-btn"
                    disabled={!inspected || sharingOtp}
                    onClick={shareOtp}
                    data-testid="track-share-final-otp"
                  >
                    {sharingOtp ? (
                      <Loader2 className="mw-spin" size={15} />
                    ) : (
                      <KeyRound size={15} />
                    )}
                    {sharingOtp ? "Preparing OTP…" : "Share Final OTP"}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {enquiry.status === "Delivered" || enquiry.status === "Completed" ? (
            <div className="mw-trk-delivered" data-testid="track-delivered">
              <PackageCheck size={22} />
              <div>
                <strong>Vehicle Delivered</strong>
                <p>
                  The workshop verified your final OTP and handed over the vehicle. This job is now
                  completed.
                </p>
                <small>
                  {enquiry.delivery.deliveredAt
                    ? `Delivered ${new Date(enquiry.delivery.deliveredAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "Vehicle handover confirmed by the workshop."}
                </small>
              </div>
            </div>
          ) : null}

          {enquiry.status === "Rejected" ? (
            <div className="mw-trk-rejected" data-testid="track-rejected">
              <XCircle size={18} />
              <p>
                You rejected this estimate. No payment was taken. Call the workshop if you want a
                revised quote.
              </p>
            </div>
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

      {enquiry.workshopName && enquiry.status !== "New" && enquiry.status !== "Rejected" ? (
        dispute ? (
          <div className="mw-trk-dispute" data-testid="track-dispute">
            <AlertTriangle size={15} />
            <div>
              <strong>
                Dispute {dispute.id} · {dispute.status}
              </strong>
              <span>
                {dispute.status === "Open"
                  ? "The admin team is reviewing your report. Do not pay cash or offline."
                  : dispute.resolution || "Reviewed and closed by the admin team."}
              </span>
            </div>
          </div>
        ) : (
          <div className="mw-trk-report-row">
            <p>
              <strong>Asked for cash or an offline payment?</strong>
              <span>That is not allowed. Report the workshop to the admin team.</span>
            </p>
            <button
              type="button"
              className="mw-trk-report-btn"
              onClick={report}
              disabled={reporting}
              data-testid="track-report-workshop"
            >
              <AlertTriangle size={14} /> {reporting ? "Sending…" : "Report Workshop"}
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}
