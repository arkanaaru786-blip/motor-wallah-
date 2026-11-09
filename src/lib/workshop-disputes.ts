/**
 * Cash / offline payment disputes raised from the customer's Track Service page.
 *
 * A dispute is separate from the enquiry so the admin desk can work through a
 * simple queue without changing the workshop's repair status. Reporting is
 * allowed only with the booking's mobile number, and an enquiry can have one
 * open dispute at a time.
 */
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { estimateTotals, getEnquiry, type WorkshopEnquiry } from "@/lib/workshop-enquiries";

const KEY = "mw_workshop_disputes_v1";
export const DISPUTE_EVENT = "mw-workshop-disputes";

export type DisputeStatus = "Open" | "Resolved";

export type WorkshopDispute = {
  id: string;
  enquiryId: string;
  trackingId: string;
  customerName: string;
  customerMobile: string;
  partnerId: string;
  workshopName: string;
  vehicleNumber: string;
  vehicle: string;
  amount: number;
  reason: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string;
};

export type DisputeResult = { ok: true; dispute: WorkshopDispute } | { ok: false; error: string };
export type ResolveDisputeResult = { ok: true } | { ok: false; error: string };

function readAll(): WorkshopDispute[] {
  const raw = replicaRead<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  return (raw as WorkshopDispute[]).filter(
    (row) => row && typeof row.id === "string" && typeof row.enquiryId === "string",
  );
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DISPUTE_EVENT));
}

function newDisputeId(existing: WorkshopDispute[]): string {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const id = `MW-DSP-${Math.floor(Math.random() * 90000) + 10000}`;
    if (!existing.some((row) => row.id === id)) return id;
  }
  return `MW-DSP-${String(Date.now()).slice(-5)}`;
}

export const findDisputeForEnquiry = (enquiryId: string): WorkshopDispute | null =>
  readAll().find((row) => row.enquiryId === enquiryId) ?? null;

export const workshopDisputes = (): WorkshopDispute[] =>
  readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const openDisputeCount = (): number =>
  readAll().filter((row) => row.status === "Open").length;

export function reportWorkshop(
  enquiryId: string,
  mobile: string,
  reason = "Workshop asked for cash or an offline payment.",
): DisputeResult {
  const enquiry: WorkshopEnquiry | null = getEnquiry(enquiryId);
  if (!enquiry) return { ok: false, error: "This booking could not be found." };
  if (enquiry.mobile.replace(/\s+/g, "") !== mobile.trim().replace(/\s+/g, "")) {
    return { ok: false, error: "The mobile number does not match this booking." };
  }
  if (!enquiry.workshopName) {
    return { ok: false, error: "A workshop has not accepted this booking yet." };
  }

  const rows = readAll();
  if (rows.some((row) => row.enquiryId === enquiryId && row.status === "Open")) {
    return { ok: false, error: "A dispute for this booking is already open with the admin team." };
  }

  const totals = estimateTotals(enquiry);
  const dispute: WorkshopDispute = {
    id: newDisputeId(rows),
    enquiryId,
    trackingId: enquiry.trackingId,
    customerName: enquiry.customerName,
    customerMobile: enquiry.mobile,
    partnerId: enquiry.partnerId ?? "",
    workshopName: enquiry.workshopName,
    vehicleNumber: enquiry.vehicleNumber,
    vehicle: enquiry.vehicle,
    amount: enquiry.approval.lockedTotal ?? totals.total,
    reason: reason.trim().slice(0, 500) || "Workshop asked for cash or an offline payment.",
    status: "Open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    resolution: "",
  };

  if (!replicaWrite(KEY, [dispute, ...rows])) {
    return { ok: false, error: "The dispute could not be saved. Please try again." };
  }
  notify();
  return { ok: true, dispute };
}

export function resolveWorkshopDispute(
  disputeId: string,
  resolvedBy: string,
  resolution: string,
): ResolveDisputeResult {
  const rows = readAll();
  const dispute = rows.find((row) => row.id === disputeId);
  if (!dispute) return { ok: false, error: "That dispute could not be found." };
  if (dispute.status === "Resolved") return { ok: true };

  const now = new Date().toISOString();
  const next = rows.map((row) =>
    row.id === disputeId
      ? {
          ...row,
          status: "Resolved" as const,
          resolvedAt: now,
          resolvedBy: resolvedBy.trim() || "Admin",
          resolution: resolution.trim().slice(0, 500) || "Reviewed and closed by the admin team.",
        }
      : row,
  );
  if (!replicaWrite(KEY, next)) {
    return { ok: false, error: "The resolution could not be saved. Please try again." };
  }
  notify();
  return { ok: true };
}
