import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { LEAD_QUEUE_KEY, readLeadQueue, type Lead } from "@/lib/leads";
import { listOffers, type ListingOffer, type OfferStatus } from "@/lib/listing-offers";
import { SERVICE_STATUSES, liveStageIndex } from "@/lib/service-tracking";
import {
  CUSTOMER_STATUS_LABEL,
  estimateTotals,
  findEnquiryByTracking,
  type EnquiryStatus,
} from "@/lib/workshop-enquiries";

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

function readJson<T>(key: string, fallback: T): T {
  return replicaRead<T>(key, fallback);
}

/* ------------------------------------------------------------------ saved */

export function savedVehicleIds(): string[] {
  const raw = readJson<unknown>(SHORTLIST_KEY, []);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
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
  return replicaWrite(LEAD_QUEUE_KEY, leads);
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
  if (!found) return { ok: false, error: "This ad could not be found." };
  if (!writeLeadQueue(next))
    return {
      ok: false,
      error: "Your changes could not be saved. Please check your connection and retry.",
    };
  return { ok: true };
}

/** Remove one of the customer's own ads from this device. */
export function deleteOwnListing(id: string): { ok: boolean; error?: string } {
  const queue = readLeadQueue();
  const next = queue.filter((lead) => !(lead.type === "sell_vehicle" && lead.createdAt === id));
  if (next.length === queue.length) return { ok: false, error: "This ad could not be found." };
  if (!writeLeadQueue(next))
    return {
      ok: false,
      error: "Your ad could not be removed. Please check your connection and retry.",
    };
  const statuses = readListingStatuses();
  delete statuses[id];
  replicaWrite(LISTING_STATUS_KEY, statuses);
  return { ok: true };
}

export function setOwnListingStatus(
  id: string,
  status: OwnListingStatus,
): { ok: boolean; error?: string } {
  const statuses = readListingStatuses();
  statuses[id] = status;
  return replicaWrite(LISTING_STATUS_KEY, statuses)
    ? { ok: true }
    : {
        ok: false,
        error: "The status could not be saved. Please check your connection and retry.",
      };
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
  /** Set once the workshop sends a final estimate. */
  estimateTotal: number | null;
  workshopName: string | null;
};

const TRACKED_TYPES: Record<string, TrackedLead["kind"]> = {
  finance_enquiry: "finance",
  insurance_enquiry: "insurance",
  service_booking: "service",
  workshop_enquiry: "service",
  franchise_enquiry: "franchise",
};

const ENQUIRY_TONE: Record<EnquiryStatus, LeadTone> = {
  New: "pending",
  Accepted: "progress",
  "Vehicle Received": "progress",
  "Estimate Sent": "progress",
  Approved: "progress",
  "Estimate Locked": "progress",
  Paid: "done",
  "Ready for Delivery": "progress",
  Delivered: "done",
  Completed: "done",
  Rejected: "pending",
  Cancelled: "pending",
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
        lead.type === "service_booking" || lead.type === "workshop_enquiry"
          ? serviceProgress(lead).tone === "done"
          : /approv|sanction|confirm/i.test(recordedStatus ?? "");
      const workshopEnquiry =
        lead.type === "workshop_enquiry" && reference ? findEnquiryByTracking(reference) : null;
      const status = workshopEnquiry
        ? CUSTOMER_STATUS_LABEL[workshopEnquiry.status]
        : approved
          ? "Approved"
          : "Pending";
      const tone: LeadTone = workshopEnquiry
        ? ENQUIRY_TONE[workshopEnquiry.status]
        : approved
          ? "done"
          : "pending";

      const title =
        lead.vehicleName ||
        [fields["brand"], fields["model"]].filter(Boolean).join(" ") ||
        fields["category"] ||
        KIND_LABEL[kind];
      const detailBits = [
        fields["category"],
        fields["department"],
        fields["policyType"],
        fields["serviceType"],
        fields["vehicleNumber"],
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
              ? reference
                ? `/track?id=${encodeURIComponent(reference)}`
                : "/track"
              : "/finance";

      return {
        id: `${lead.type}-${lead.createdAt}`,
        kind,
        label: KIND_LABEL[kind],
        title,
        detail: detailBits.slice(0, 2).join(" · "),
        reference,
        status,
        tone,
        createdAt: lead.createdAt,
        href,
        estimateTotal:
          workshopEnquiry && workshopEnquiry.checklist.sentAt
            ? estimateTotals(workshopEnquiry).total
            : null,
        workshopName: workshopEnquiry?.workshopName ?? null,
      };
    })
    .reverse();
}

/* ----------------------------------------------------------------- counts */

export function dashboardCounts() {
  return {
    saved: savedVehicleIds().length,
    // Chats are stored in Supabase; the dashboard fills this from the live
    // unread count (see ChatsTab / AccountPage) instead of the replica.
    chats: 0,
    offers: listOffers().length,
    listings: ownListings().length,
    leads: trackedLeads().length,
  };
}

export type { ListingOffer, OfferStatus };
