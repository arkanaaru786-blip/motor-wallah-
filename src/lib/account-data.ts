import { readLeadQueue, type Lead } from "@/lib/leads";
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
/** Same key + record shape as src/lib/listing-chat.ts. */
const CHAT_KEY = "mw_listing_chat";
/** Dashboard-only status overrides for a customer's own SELL submissions. */
const LISTING_STATUS_KEY = "mw_my_listing_status";

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

export type ChatMessage = { id: string; listingId: string; body: string; createdAt: string };
export type ChatThread = { listingId: string; messages: ChatMessage[]; lastAt: string };

export function chatThreads(): ChatThread[] {
  const raw = readJson<Record<string, ChatMessage[]>>(CHAT_KEY, {});
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .map(([listingId, messages]) => {
      const list = Array.isArray(messages)
        ? messages.filter((m) => typeof m?.body === "string")
        : [];
      return {
        listingId,
        messages: list,
        lastAt: list.at(-1)?.createdAt ?? "",
      };
    })
    .filter((thread) => thread.messages.length > 0)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** Append one follow-up message to a thread, mirroring listing-chat.ts. */
export function appendChatMessage(
  listingId: string,
  body: string,
): { ok: boolean; error?: string } {
  const text = body.trim();
  if (!text) return { ok: false, error: "Type a message first." };
  const threads = readJson<Record<string, ChatMessage[]>>(CHAT_KEY, {});
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    listingId,
    body: text.slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
  threads[listingId] = [...(threads[listingId] ?? []), message].slice(-50);
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(threads));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "This browser blocked local storage, so your message was not saved.",
    };
  }
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
      const progress =
        lead.type === "service_booking"
          ? serviceProgress(lead)
          : {
              status: recordedStatus ?? "Submitted",
              tone: (recordedStatus ? "progress" : "pending") as LeadTone,
            };

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
        status: progress.status,
        tone: progress.tone,
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
