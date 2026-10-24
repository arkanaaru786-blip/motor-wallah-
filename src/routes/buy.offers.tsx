import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Inbox } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { listOffers, type ListingOffer, type OfferStatus } from "@/lib/listing-offers";
import { getBuyListing, lakhLabel, rupees } from "@/lib/buy-catalog";

const TITLE = "My Offers — Track Your Vehicle Offers | Motor Wallah";
const DESCRIPTION =
  "Track every offer you have made on Motor Wallah: Pending, Counter Offer and Accepted statuses in one place.";

/** Status badge colours from the reference design. */
const STATUS_CLASS: Record<OfferStatus, string> = {
  Pending: "buy-offer-badge buy-offer-badge--pending",
  "Counter Offer": "buy-offer-badge buy-offer-badge--counter",
  Accepted: "buy-offer-badge buy-offer-badge--accepted",
  Rejected: "buy-offer-badge buy-offer-badge--rejected",
};

const STATUS_NOTE: Record<OfferStatus, string> = {
  Pending: "Seller will respond soon.",
  "Counter Offer": "Seller countered with a new amount — review it and respond.",
  Accepted: "Seller accepted your offer. The Motor Wallah team will contact you.",
  Rejected: "Seller declined this offer.",
};

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const Route = createFileRoute("/buy/offers")({
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
  component: MyOffersPage,
});

function MyOffersPage() {
  // Read after mount only: the server renders the empty state, then the
  // client replaces it with this device's stored offers (no hydration
  // mismatch — localStorage does not exist during SSR).
  const [offers, setOffers] = useState<ListingOffer[]>([]);
  useEffect(() => {
    setOffers(listOffers());
  }, []);

  return (
    <div className="mw-buy min-h-screen pb-16 md:pb-0">
      <SiteHeader pills />
      <main>
        <div className="home-container buy-offers-page">
          <div className="buy-offers-head">
            <div>
              <p className="buy-kicker">
                <span>Step 6</span> Offer tracking
              </p>
              <h1 className="buy-offers-title">My Offers</h1>
              <p className="buy-offers-sub">
                {offers.length === 0
                  ? "Offers you submit on any listing appear here with their status."
                  : `${offers.length} offer${offers.length === 1 ? "" : "s"} submitted from this device.`}
              </p>
            </div>
            <Link to="/buy" className="buy-offers-back">
              Browse more vehicles <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>

          {offers.length === 0 ? (
            <div className="buy-offers-empty">
              <Inbox size={30} aria-hidden="true" />
              <p className="buy-offers-empty-title">No offers yet</p>
              <p className="buy-offers-empty-text">
                Open any vehicle and press “Make an offer” — your offer will be tracked here with a
                Pending badge until the seller responds.
              </p>
              <Link to="/buy" className="buy-primary-button">
                Go to the marketplace
              </Link>
            </div>
          ) : (
            <ul className="buy-offers-list">
              {offers.map((offer: ListingOffer) => {
                const listing = getBuyListing(offer.listingId);
                const image = listing?.images[0];
                return (
                  <li key={offer.id}>
                    <Link
                      to="/buy/vehicle/$id"
                      params={{ id: offer.listingId }}
                      className="buy-offer-row"
                    >
                      <span className="buy-offer-thumb">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            aria-hidden="true"
                            width={120}
                            height={80}
                            loading="lazy"
                          />
                        ) : (
                          <Inbox size={18} aria-hidden="true" />
                        )}
                      </span>
                      <span className="buy-offer-main">
                        <span className="buy-offer-top">
                          <span className="buy-offer-name">{offer.listingName}</span>
                          <span className={STATUS_CLASS[offer.status]}>{offer.status}</span>
                        </span>
                        <span className="buy-offer-amount">{rupees(offer.amount)}</span>
                        <span className="buy-offer-meta">
                          Offered on: {formatWhen(offer.createdAt)}
                          {listing ? ` · Asking ${lakhLabel(listing.priceLakh)}` : ""}
                        </span>
                        <span className="buy-offer-note">{STATUS_NOTE[offer.status]}</span>
                      </span>
                      <ChevronRight className="buy-offer-chevron" size={18} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="buy-offers-notice">
            <strong>Offers are stored on this device.</strong>
            <p>
              This project has no seller-side offer backend yet, so every new offer stays at status{" "}
              <em>Pending</em> — no seller has accepted, rejected or countered it automatically.
              Counter Offer and Accepted badges appear only for offers whose status was actually
              recorded as such.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
