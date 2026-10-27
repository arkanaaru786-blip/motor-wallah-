/**
 * Live service tracking (currently mocked) shared by the booking success
 * screen (/services) and the Track Service page (/track).
 *
 * The Tracking ID is generated when a booking is submitted and stored with
 * the lead (fields.trackingId), so /track can pair it with the mobile number
 * the customer enters. Statuses are simulated for now — no backend yet.
 */

/** MW-SRV-12345 */
export const TRACKING_ID_RE = /^MW-SRV-\d{5}$/;

export const newTrackingId = (): string =>
  `MW-SRV-${Math.floor(Math.random() * 90000) + 10000}`;

export const isTrackingId = (value: string): boolean => TRACKING_ID_RE.test(value.trim());

export type ServiceStatus = {
  key: "pending" | "picked-up" | "in-service" | "ready" | "delivered";
  label: string;
  text: string;
};

export const SERVICE_STATUSES: ServiceStatus[] = [
  { key: "pending", label: "Pending", text: "Request Received." },
  {
    key: "picked-up",
    label: "Picked Up",
    text: "Vehicle picked up from customer (for doorstep service).",
  },
  { key: "in-service", label: "In Service", text: "Work in progress at the workshop." },
  { key: "ready", label: "Ready", text: "Service completed, ready for delivery." },
  { key: "delivered", label: "Delivered", text: "Vehicle handed over to customer." },
];

/**
 * Mock timeline for a real booking: one stage per minute after submission,
 * so a fresh request shows "Pending" and progresses on its own. The clock
 * re-ticks while the Track page is open, which makes the bar feel live.
 */
export const STAGE_MS = 60_000;

export const liveStageIndex = (createdAtMs: number, nowMs: number): number => {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return 0;
  const elapsed = Math.max(0, nowMs - createdAtMs);
  return Math.min(SERVICE_STATUSES.length - 1, Math.floor(elapsed / STAGE_MS));
};

/** Deterministic mock stage for IDs with no local booking record. */
export const mockStageIndex = (trackingId: string): number => {
  const digits = trackingId.replace(/\D/g, "");
  const sum = digits.split("").reduce((acc, d) => acc + Number(d), 0);
  return sum % SERVICE_STATUSES.length;
};
