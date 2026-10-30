/**
 * Insurance application references and the (mocked) policy status timeline.
 *
 * The Reference ID is generated when a plan is selected and stored with the
 * lead (fields.referenceId), so the Track Policy Status screen can pair it with
 * the application this device submitted. Statuses are simulated for now — no
 * insurer backend exists yet.
 */

/** MW-INS-12345 */
export const REFERENCE_ID_RE = /^MW-INS-\d{5}$/;

export const isReferenceId = (value: string) => REFERENCE_ID_RE.test(value.trim().toUpperCase());

/** A random, unused reference ID in the MW-INS-##### format. */
export const newReferenceId = (taken: Iterable<string> = []): string => {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = `MW-INS-${Math.floor(10000 + Math.random() * 90000)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `MW-INS-${String(Date.now()).slice(-5)}`;
};

export type PolicyStatus = {
  key: "submitted" | "under-review" | "issued";
  label: string;
  text: string;
};

export const POLICY_STATUSES: PolicyStatus[] = [
  {
    key: "submitted",
    label: "Submitted",
    text: "Application received with your vehicle and plan details.",
  },
  {
    key: "under-review",
    label: "Under Review",
    text: "The insurer is verifying the vehicle, documents and premium.",
  },
  {
    key: "issued",
    label: "Policy Issued",
    text: "Policy issued — the certificate and receipt are shared on WhatsApp.",
  },
];

/**
 * Mock timeline for a real application on this device: the status moves on
 * one step every 90 seconds, so a fresh application starts at "Submitted" and
 * progresses while the track screen is open.
 */
export const POLICY_STAGE_MS = 90_000;

export const livePolicyStage = (createdAtMs: number, nowMs: number): number => {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return 0;
  const elapsed = Math.max(0, nowMs - createdAtMs);
  return Math.min(POLICY_STATUSES.length - 1, Math.floor(elapsed / POLICY_STAGE_MS));
};

/** Deterministic sample stage for a well-formed ID this device did not submit. */
export const samplePolicyStage = (referenceId: string): number => {
  const digits = referenceId.replace(/\D/g, "");
  const sum = digits.split("").reduce((acc, digit) => acc + Number(digit), 0);
  return sum % POLICY_STATUSES.length;
};

export const policyWhatsAppMessage = (referenceId: string, vehicle: string, insurer: string) =>
  `Hi Motor Wallah, I want updates on my vehicle insurance application.\nReference ID: ${referenceId}\nVehicle: ${vehicle}\nInsurer: ${insurer}\nPlease share the policy status.`;
