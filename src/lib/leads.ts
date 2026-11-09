/**
 * Lead capture interface.
 * Every customer intent (WhatsApp, call, test drive, finance, insurance,
 * general enquiry) flows through submitLead so it can later be pointed at
 * the Motor Wallah CRM / backend without touching any UI component.
 */
import { replicaRead, replicaWrite, startCloudSync } from "@/lib/cloud-store";
import { supabaseClient } from "@/lib/supabase";

export type LeadType =
  | "whatsapp_click"
  | "call_click"
  | "test_drive"
  | "finance_enquiry"
  | "insurance_enquiry"
  | "warranty_enquiry"
  | "sell_car"
  | "sell_vehicle"
  | "exchange_car"
  | "exchange_vehicle"
  | "scrap_vehicle"
  | "service_booking"
  | "workshop_enquiry"
  | "parts_enquiry"
  | "decor_fitter"
  | "decor_partner"
  | "decor_order"
  | "franchise_enquiry"
  | "listing_enquiry"
  | "listing_offer"
  | "listing_report"
  | "general_enquiry";

export type Lead = {
  type: LeadType;
  source: string;
  vehicleId?: string | undefined;
  vehicleName?: string | undefined;
  location?: string | undefined;
  name?: string | undefined;
  mobile?: string | undefined;
  fields?: Record<string, string> | undefined;
  /** Customer-uploaded car photos (internal evaluation view only). */
  photos?: import("./uploads").UploadedFile[] | undefined;
  /** RC / insurance / other supporting documents. */
  documents?: import("./uploads").UploadedFile[] | undefined;
  /** Preliminary indicative market estimate, in rupees. */
  estimate?: { low: number; high: number; confidence: string; notes: string[] } | undefined;
  /** Internal only: customer expected price vs AI estimate midpoint. */
  expectation?:
    { expectedPrice: number; aiMidpoint: number; gap: number; gapPercent: number } | undefined;
  createdAt: string;
};

const QUEUE_KEY = "mw_lead_queue";

/**
 * Every lead is written to the lead queue (Supabase `app_records`, replicated
 * on device so the dashboard reads it synchronously) and, as a structured row,
 * to the `leads` table. When a CRM/webhook URL is configured as
 * VITE_LEAD_ENDPOINT the same record is also POSTed there best-effort.
 * Delivery never blocks or fails the UI — the queue always keeps the record.
 */
const LEAD_ENDPOINT: string | undefined = import.meta.env["VITE_LEAD_ENDPOINT"];

/**
 * Structured copy for reporting and staff queries.
 *
 * Uploaded photos and documents are kept as metadata only: a base64 image in a
 * jsonb column is megabytes per lead. The full record with the data URLs stays
 * in the queue where the UI expects it.
 */
async function insertLeadRecord(record: Lead): Promise<void> {
  // A visitor can submit before the anonymous session exists, so wait for the
  // cloud layer to finish booting first — the row is worthless without auth.
  await startCloudSync();
  const client = supabaseClient();
  if (!client) return;
  const stripFiles = (files: Lead["photos"]) =>
    (files ?? []).map((file) => ({
      name: (file as { name?: string }).name ?? "file",
      type: (file as { type?: string }).type ?? "",
      size: (file as { size?: number }).size ?? 0,
    }));
  try {
    await client.from("leads").insert({
      type: record.type,
      source: record.source,
      vehicle_id: record.vehicleId ?? null,
      vehicle_name: record.vehicleName ?? null,
      location: record.location ?? null,
      name: record.name ?? null,
      mobile: record.mobile ?? null,
      fields: record.fields ?? {},
      payload: {
        estimate: record.estimate ?? null,
        expectation: record.expectation ?? null,
        photos: stripFiles(record.photos),
        documents: stripFiles(record.documents),
        createdAt: record.createdAt,
      },
      created_at: record.createdAt,
    });
  } catch {
    /* the queue already holds the lead — a failed insert must not break capture */
  }
}

/**
 * The form types that also send email: a thank-you to the customer when they
 * left an email, and an internal alert to the admin inbox. Click tracking
 * (WhatsApp/call buttons, listing reports) is deliberately quiet — one email
 * per tap would bury the leads that need a callback.
 */
const EMAILED_LEADS = new Set<LeadType>([
  "finance_enquiry",
  "insurance_enquiry",
  "service_booking",
  "workshop_enquiry",
  "sell_vehicle",
  "sell_car",
  "franchise_enquiry",
]);

/** Personal numbers and identity documents never travel by email. */
const PRIVATE_FIELD = /pan|aadhaar|aadhar|ifsc|account|upi|cvv|card/i;

const trimmed = (value: string | undefined): string => (value ?? "").trim();

/** The customer's email, if the form asked for one (only Franchise does today). */
function emailOf(record: Lead): string | undefined {
  const fromFields = Object.entries(record.fields ?? {}).find(
    ([key, value]) => /email/i.test(key) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed(value)),
  );
  const candidate = trimmed(fromFields?.[1]);
  return candidate === "" ? undefined : candidate;
}

/** The reference the customer was shown, so the email can quote it back. */
function referenceOf(record: Lead): string | undefined {
  const fields = record.fields ?? {};
  const value =
    fields["referenceId"] ?? fields["trackingId"] ?? fields["orderId"] ?? fields["bookingId"] ?? "";
  return trimmed(value) === "" ? undefined : trimmed(value);
}

/** Up to a dozen labelled details for the internal alert only. */
function detailsOf(record: Lead): Record<string, string> {
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.fields ?? {})) {
    if (Object.keys(details).length >= 12) break;
    if (PRIVATE_FIELD.test(key)) continue;
    if (["name", "mobile", "email"].includes(key)) continue;
    const text = trimmed(value);
    if (text === "") continue;
    details[key] = text.slice(0, 300);
  }
  return details;
}

/**
 * Ask the server to send this lead's emails. Fire-and-forget: the lead is
 * already stored, so a network failure or a missing Resend key is logged and
 * forgotten rather than surfaced to the customer.
 */
async function sendFormAlertEmail(record: Lead): Promise<void> {
  if (!EMAILED_LEADS.has(record.type)) return;
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: record.type,
        source: record.source,
        ...(trimmed(record.name) ? { name: trimmed(record.name) } : {}),
        ...(trimmed(record.mobile) ? { mobile: trimmed(record.mobile) } : {}),
        ...(emailOf(record) ? { email: emailOf(record) } : {}),
        ...(trimmed(record.vehicleName) ? { vehicleName: trimmed(record.vehicleName) } : {}),
        ...(referenceOf(record) ? { reference: referenceOf(record) } : {}),
        details: detailsOf(record),
      }),
    });
    if (!response.ok) {
      console.warn(`[lead-email] alert not sent (HTTP ${response.status})`);
    }
  } catch {
    /* offline or server restarting — the lead itself is already saved */
  }
}

export async function submitLead(lead: Omit<Lead, "createdAt">): Promise<{ ok: true }> {
  const record: Lead = { ...lead, createdAt: new Date().toISOString() };
  try {
    if (typeof window !== "undefined") {
      const prev = replicaRead<Lead[]>(QUEUE_KEY, []);
      replicaWrite(QUEUE_KEY, [...prev, record].slice(-100));
    }
  } catch {
    /* storage unavailable — lead capture must never break the UI */
  }
  void insertLeadRecord(record);
  if (typeof window !== "undefined") void sendFormAlertEmail(record);
  if (LEAD_ENDPOINT) {
    try {
      await fetch(LEAD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch {
      /* delivery failed — the local queue already holds the lead */
    }
  }
  return { ok: true };
}

export const readLeadQueue = (): Lead[] => replicaRead<Lead[]>(QUEUE_KEY, []);

/** Re-exported so the stores that share this queue can point at the same helper. */
export const LEAD_QUEUE_KEY = QUEUE_KEY;
