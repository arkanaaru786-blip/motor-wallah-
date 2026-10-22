/**
 * Lead capture interface.
 * Every customer intent (WhatsApp, call, test drive, finance, insurance,
 * general enquiry) flows through submitLead so it can later be pointed at
 * the Motor Wallah CRM / backend without touching any UI component.
 */
export type LeadType =
  | "whatsapp_click"
  | "call_click"
  | "test_drive"
  | "finance_enquiry"
  | "insurance_enquiry"
  | "warranty_enquiry"
  | "sell_car"
  | "exchange_car"
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

/** Local-only for now. Swap the body for a CRM/server call when the backend exists. */
export async function submitLead(lead: Omit<Lead, "createdAt">): Promise<{ ok: true }> {
  const record: Lead = { ...lead, createdAt: new Date().toISOString() };
  try {
    if (typeof window !== "undefined") {
      const prev = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as Lead[];
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...prev, record].slice(-100)));
    }
  } catch {
    /* storage unavailable — lead capture must never break the UI */
  }
  return { ok: true };
}

export const readLeadQueue = (): Lead[] => {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as Lead[];
  } catch {
    return [];
  }
};
