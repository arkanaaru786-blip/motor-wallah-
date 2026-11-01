import { readLeadQueue, type Lead } from "@/lib/leads";
import {
  chatThreads as readChatThreads,
  sendChatMessage,
  type ChatThread,
} from "@/lib/listing-chat";
import { listOffers, type ListingOffer, type OfferStatus } from "@/lib/listing-offers";
import { SERVICE_STATUSES, liveStageIndex } from "@/lib/service-tracking";

/**
 * Read-only view of everything the dashboard shows, assembled from the stores
 * the existing flows already write (BUY shortlist, listing chat, listing
 * offers, SELL submissions and the shared lead queue).
 *
 * Nothing here invents activity: if a tab has no stored records it stays
 * empty with an explanation.
 */

/** Same key as src/lib/shortlist.ts (the BUY wishlist). */
const SHORTLIST_KEY = "mw_buy_shortlist";
/** Dashboard-only status overrides for a customer's own SELL submissions. */
const LISTING_STATUS_KEY = "mw_my_listing_status";
/** Same key as src/lib/leads.ts (the shared lead queue). */
const LEAD_QUEUE_KEY = "mw_lead_queue";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ saved */

export function savedVehicleIds(): string[] {
  const raw = readJson<unknown>(SHORTLIST_KEY, []);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

/* ------------------------------------------------------------------ chats */

/** The buyer's side of the shared listing conversations. */
export type { ChatThread };

export function chatThreads(): ChatThread[] {
  return readChatThreads("buyer");
}

/** Append one follow-up buyer message to a thread. */
export function appendChatMessage(
  listingId: string,
  body: string,
): { ok: boolean; error?: string } {
  if (!body.trim()) return { ok: false, error: "Type a message first." };
  const message = sendChatMessage(listingId, "buyer", body);
  return message
    ? { ok: true }
    : { ok: false, error: "This browser blocked local storage, so your message was not saved." };
}

/* --------------------------------------------------------------- listings */

export type OwnListingStatus = "Active" | "Sold";

export type OwnListing = {
  /** Stable key: the SELL submission timestamp. */
  id: string;
  name: string;
  category: string;
  year: string;
  location: string;
  expectedPrice: string;
  photo: string | null;
  createdAt: string;
  status: OwnListingStatus;
};

function readListingStatuses(): Record<string, OwnListingStatus> {
  return readJson<Record<string, OwnListingStatus>>(LISTING_STATUS_KEY, {});
}

export function ownListings(): OwnListing[] {
  const statuses = readListingStatuses();
  return readLeadQueue()
    .filter((lead) => lead.type === "sell_vehicle")
    .map((lead) => {
      const fields = lead.fields ?? {};
      const photo = (lead.photos?.[0] ?? null) as { dataUrl?: string; url?: string } | null;
      return {
        id: lead.createdAt,
        name:
          lead.vehicleName ||
          `${fields["year"] ?? ""} ${fields["brand"] ?? ""} ${fields["model"] ?? ""}`.trim(),
        category: fields["category"] ?? "Vehicle",
        year: fields["year"] ?? "",
        location: lead.location ?? fields["location"] ?? "",
        expectedPrice: fields["expectedPrice"] ?? "",
        photo: photo?.dataUrl ?? photo?.url ?? null,
        createdAt: lead.createdAt,
        status: statuses[lead.createdAt] ?? "Active",
      };
    })
    .reverse();
}

export type OwnListingEdit = { name: string; price: string; city: string; category: string };

function writeLeadQueue(leads: Lead[]): boolean {
  try {
    window.localStorage.setItem(LEAD_QUEUE_KEY, JSON.stringify(leads));
    return true;
  } catch {
    return false;
  }
}

/** Edit the title, price, city or category of one of the customer's own ads. */
export function updateOwnListing(
  id: string,
  edit: OwnListingEdit,
): { ok: boolean; error?: string } {
  const title = edit.name.trim();
  const price = edit.price.trim();
  if (!title) return { ok: false, error: "Give your ad a title before saving." };
  if (edit.price && !/^\d{1,3}(,\d{3})*$|^\d+$/.test(price))
    return { ok: false, error: "Enter the price in digits, for example 525000." };

  const queue = readLeadQueue();
  let found = false;
  const next = queue.map((lead) => {
    if (lead.type !== "sell_vehicle" || lead.createdAt !== id) return lead;
    found = true;
    return {
      ...lead,
      vehicleName: title,
      location: edit.city.trim() || lead.location,
      fields: {
        ...(lead.fields ?? {}),
        expectedPrice: price,
        city: edit.city.trim(),
        category: edit.category.trim() || lead.fields?.["category"] || "",
      },
    };
  });
  if (!found) return { ok: false, error: "This ad could not be found on this device." };
  if (!writeLeadQueue(next))
    return { ok: false, error: "This browser blocked local storage, so the ad was not saved." };
  return { ok: true };
}

/** Remove one of the customer's own ads from this device. */
export function deleteOwnListing(id: string): { ok: boolean; error?: string } {
  const queue = readLeadQueue();
  const next = queue.filter((lead) => !(lead.type === "sell_vehicle" && lead.createdAt === id));
  if (next.length === queue.length)
    return { ok: false, error: "This ad could not be found on this device." };
  if (!writeLeadQueue(next))
    return { ok: false, error: "This browser blocked local storage, so the ad was not removed." };
  const statuses = readListingStatuses();
  delete statuses[id];
  try {
    window.localStorage.setItem(LISTING_STATUS_KEY, JSON.stringify(statuses));
  } catch {
    /* the ad itself is already gone; a stale status key is harmless */
  }
  return { ok: true };
}

export function setOwnListingStatus(
  id: string,
  status: OwnListingStatus,
): { ok: boolean; error?: string } {
  const statuses = readListingStatuses();
  statuses[id] = status;
  try {
    window.localStorage.setItem(LISTING_STATUS_KEY, JSON.stringify(statuses));
    return { ok: true };
  } catch {
    return { ok: false, error: "This browser blocked local storage, so the status was not saved." };
  }
}

/* ------------------------------------------------------------------ leads */

export type LeadTone = "pending" | "progress" | "done";

export type TrackedLead = {
  id: string;
  kind: "finance" | "insurance" | "service" | "franchise";
  label: string;
  title: string;
  detail: string;
  reference: string | null;
  status: string;
  tone: LeadTone;
  createdAt: string;
  href: string;
};

const TRACKED_TYPES: Record<string, TrackedLead["kind"]> = {
  finance_enquiry: "finance",
  insurance_enquiry: "insurance",
  service_booking: "service",
  franchise_enquiry: "franchise",
};

const KIND_LABEL: Record<TrackedLead["kind"], string> = {
  finance: "Finance application",
  insurance: "Insurance application",
  service: "Service booking",
  franchise: "Franchise application",
};

/** Any reference-style value the flow stored with the lead. */
function leadReference(lead: Lead): string | null {
  const fields = lead.fields ?? {};
  for (const key of ["referenceId", "trackingId", "applicationId"]) {
    const value = fields[key];
    if (value) return value;
  }
  const match = Object.values(fields).find((value) =>
    /^(MW|[A-Z]{2,4})-[A-Z0-9-]{3,}$/.test(value),
  );
  return match ?? null;
}

function serviceProgress(lead: Lead): { status: string; tone: LeadTone } {
  const created = Date.parse(lead.createdAt);
  if (!Number.isFinite(created)) return { status: "Submitted", tone: "pending" };
  const stage = SERVICE_STATUSES[liveStageIndex(created, Date.now())] ?? SERVICE_STATUSES[0]!;
  const tone: LeadTone =
    stage.key === "ready" || stage.key === "delivered"
      ? "done"
      : stage.key === "in-service" || stage.key === "picked-up"
        ? "progress"
        : "pending";
  return { status: stage.label, tone };
}

export function trackedLeads(): TrackedLead[] {
  return readLeadQueue()
    .filter((lead) => Boolean(TRACKED_TYPES[lead.type]))
    .map((lead) => {
      const kind = TRACKED_TYPES[lead.type]!;
      const reference = leadReference(lead);
      const fields = lead.fields ?? {};
      const recordedStatus = fields["status"];
      // Simple two-state status the dashboard shows: Pending until the record
      // itself says it was approved (or the service timeline completes).
      const approved =
        lead.type === "service_booking"
          ? serviceProgress(lead).tone === "done"
          : /approv|sanction|confirm/i.test(recordedStatus ?? "");
      const status = approved ? "Approved" : "Pending";

      const title =
        lead.vehicleName ||
        [fields["brand"], fields["model"]].filter(Boolean).join(" ") ||
        fields["category"] ||
        KIND_LABEL[kind];
      const detailBits = [
        fields["category"],
        fields["policyType"],
        fields["serviceType"],
        fields["franchiseType"],
      ]
        .concat([fields["investmentCapacity"], lead.location])
        .filter((value): value is string => Boolean(value) && value !== title);

      const href =
        kind === "insurance" && reference
          ? `/insurance?view=track&ref=${encodeURIComponent(reference)}`
          : kind === "franchise" && reference
            ? `/franchise?ref=${encodeURIComponent(reference)}`
            : kind === "service"
              ? "/track"
              : "/finance";

      return {
        id: `${lead.type}-${lead.createdAt}`,
        kind,
        label: KIND_LABEL[kind],
        title,
        detail: detailBits.slice(0, 2).join(" · "),
        reference,
        status,
        tone: (approved ? "done" : "pending") as LeadTone,
        createdAt: lead.createdAt,
        href,
      };
    })
    .reverse();
}

/* ----------------------------------------------------------------- counts */

export function dashboardCounts() {
  return {
    saved: savedVehicleIds().length,
    chats: chatThreads().length,
    offers: listOffers().length,
    listings: ownListings().length,
    leads: trackedLeads().length,
  };
}

export type { ListingOffer, OfferStatus };
