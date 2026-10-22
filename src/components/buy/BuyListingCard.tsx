import { Link } from "@tanstack/react-router";
import { BadgeCheck, Heart, Images } from "lucide-react";
import { buyListingName, fuelLabel, lakhLabel, type BuyListing } from "@/lib/buy-catalog";

/**
 * Marketplace vehicle card (reference design): image on top, small red brand
 * line, bold model name, Year · Fuel · Location row, large red price, then
 * three full-width actions — VIEW DETAILS, CHAT WITH SELLER, MAKE AN OFFER.
 *
 * `featured` renders the wide first card of the bento grid (image on the
 * left, content on the right) without changing the internal design.
 */
export function BuyListingCard({
  listing,
  featured = false,
  shortlisted,
  onToggleShortlist,
  onMakeOffer,
  onChat,
}: {
  listing: BuyListing;
  featured?: boolean;
  shortlisted: boolean;
  onToggleShortlist: (id: string) => void;
  /** Opens the Make an Offer modal — lifted to the page so the fixed panel is
   *  never clipped by the card's overflow/transform. */
  onMakeOffer: (listing: BuyListing) => void;
  /** Opens the in-site Contact Seller thread for this listing. */
  onChat: (listing: BuyListing) => void;
}) {
  const name = buyListingName(listing);

  return (
    <article className="mw-card" data-featured={featured || undefined}>
      <Link
        to="/buy/vehicle/$id"
        params={{ id: listing.id }}
        className="mw-card-media"
        aria-label={`View details of ${name}`}
      >
        <img
          src={listing.images[0]}
          alt={listing.photoAlt}
          width={720}
          height={450}
          loading="lazy"
        />
        <span className="mw-card-tags">
          {listing.verified && (
            <span className="mw-tag mw-tag--verified">
              <BadgeCheck size={12} aria-hidden="true" /> Verified
            </span>
          )}
          {listing.demo && <span className="mw-tag mw-tag--demo">Demo</span>}
        </span>
        {listing.images.length > 1 && (
          <span className="mw-card-photos">
            <Images size={13} aria-hidden="true" /> {listing.images.length}
          </span>
        )}
        <button
          type="button"
          className="mw-card-fav"
          aria-label={shortlisted ? `Remove ${name} from shortlist` : `Shortlist ${name}`}
          aria-pressed={shortlisted}
          data-active={shortlisted || undefined}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleShortlist(listing.id);
          }}
        >
          <Heart size={15} fill={shortlisted ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </Link>

      <div className="mw-card-body">
        <p className="mw-card-brand">
          {listing.brand} · {listing.categoryLabel}
        </p>
        <h3 className="mw-card-title">
          <Link to="/buy/vehicle/$id" params={{ id: listing.id }}>
            {listing.model}
            {listing.variant ? ` ${listing.variant}` : ""}
          </Link>
        </h3>
        <p className="mw-card-meta">
          <span>{listing.year}</span>
          <span aria-hidden="true">·</span>
          <span>{fuelLabel(listing.fuel)}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.city}</span>
        </p>
        <p className="mw-card-price">{lakhLabel(listing.priceLakh)}</p>
      </div>

      <div className="mw-card-actions">
        <Link to="/buy/vehicle/$id" params={{ id: listing.id }} className="mw-btn mw-btn--primary">
          View details
        </Link>
        <button
          type="button"
          className="mw-btn mw-btn--outline"
          onClick={() => onChat(listing)}
          aria-label={`Chat with seller about ${name}`}
        >
          Chat with seller
        </button>
        <button
          type="button"
          className="mw-btn mw-btn--outline"
          onClick={() => onMakeOffer(listing)}
          aria-label={`Make an offer on ${name}`}
        >
          Make an offer
        </button>
      </div>
    </article>
  );
}
