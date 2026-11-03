import { submitLead } from "@/lib/leads";

/**
 * Customer offers against a BUY listing.
 *
 * IMPORTANT — there is no seller-side or offer service in this project yet.
 * Offers are stored in Supabase against the visitor's anonymous session (see
 * cloud-store) and mirrored to the lead queue, exactly like enquiries. Nothing
 * here pretends that a seller received, accepted or rejected an offer, and the
 * asking price is never modified by this module.
 *
 * The status model (Pending / Accepted / Rejected / Counter Offer) is the shape
 * a future seller dashboard would consume; locally an offer can only ever be
 * "Pending", and the UI says so plainly.
 */
export type OfferStatus = "Pending" | "Accepted" | "Rejected" | "Counter Offer";

export type ListingOffer = {
  id: string;
  listingId: string;
  listingName: string;
  categoryLabel: string;
  city: string;
  /** Seller's asking price at the moment the offer was made (₹ lakh). */
  askingLakh: number;
  /** Customer's offer in whole rupees. */
  amount: number;
  message: string;
  name: string;
  mobile: string;
  status: OfferStatus;
  createdAt: string;
};

import { replicaRead, replicaWrite } from "@/lib/cloud-store";

const KEY = "mw_listing_offers";
const MAX_STORED = 100;

function read(): ListingOffer[] {
  const raw = replicaRead<unknown>(KEY, []);
  return Array.isArray(raw) ? (raw as ListingOffer[]) : [];
}

function write(list: ListingOffer[]): boolean {
  // Storage unavailable (private mode / quota). Callers must report this as a
  // failure instead of claiming the offer was saved.
  return replicaWrite(KEY, list.slice(-MAX_STORED));
}

export const offersForListing = (listingId: string) =>
  read().filter((offer) => offer.listingId === listingId);

/** Every offer this device has made, newest first (powers My Offers). */
export const listOffers = (): ListingOffer[] => [...read()].reverse();

/**
 * Validate + persist one offer. Returns the saved record, or an error message
 * that the UI must show verbatim — it never reports success without a write.
 */
export async function saveOffer(input: {
  listingId: string;
  listingName: string;
  categoryLabel: string;
  city: string;
  askingLakh: number;
  amount: number;
  message: string;
  name: string;
  mobile: string;
}): Promise<{ ok: true; offer: ListingOffer } | { ok: false; error: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid offer amount in rupees (greater than zero)." };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Please enter your name." };
  const mobile = input.mobile.replace(/\s+/g, "");
  if (!/^[0-9+]{10,15}$/.test(mobile)) {
    return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  }

  const offer: ListingOffer = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    listingId: input.listingId,
    listingName: input.listingName,
    categoryLabel: input.categoryLabel,
    city: input.city,
    askingLakh: input.askingLakh,
    amount: Math.round(amount),
    message: input.message.trim().slice(0, 500),
    name,
    mobile,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  const stored = [...read(), offer];
  const persisted = write(stored);
  if (!persisted) {
    return {
      ok: false,
      error:
        "This browser blocked local storage, so the offer could not be saved. " +
        "Please call or WhatsApp the Motor Wallah team instead.",
    };
  }

  // Mirror into the existing lead queue so the project's single capture point
  // holds the offer too. Still device-local until a CRM endpoint exists.
  await submitLead({
    type: "listing_offer",
    source: "make_offer",
    vehicleId: offer.listingId,
    vehicleName: offer.listingName,
    location: offer.city,
    name: offer.name,
    mobile: offer.mobile,
    fields: {
      offerAmount: String(offer.amount),
      askingPriceLakh: String(offer.askingLakh),
      message: offer.message,
      status: offer.status,
    },
  });

  return { ok: true, offer };
}
