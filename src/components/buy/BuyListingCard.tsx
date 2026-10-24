import { Link } from "@tanstack/react-router";
import { BadgeCheck, Heart, Images, MapPin } from "lucide-react";
import { fuelLabel, rupees, type BuyListing } from "@/lib/buy-catalog";

/**
 * Reference screen 4 — marketplace vehicle card for the bento grid.
 *
 * Image on top with the Verified badge and photo count, then the full vehicle
 * name, a large RED price in rupees, and the spec rows (Year · Fuel ·
 * Transmission / Km · Location). Actions: heart shortlist icon, VIEW DETAILS
 * (red) and MAKE AN OFFER (secondary).
 *
 * `featured` renders the wide first card of the bento grid (image left,
 * content right) without changing the internal design.
 */
export function BuyListingCard({
  listing,
  featured = false,
  shortlisted,
  onToggleShortlist,
  onMakeOffer,
}: {
  listing: BuyListing;
  featured?: boolean;
  shortlisted: boolean;
  onToggleShortlist: (id: string) => void;
  /** Opens the Make an Offer modal — lifted to the page so the fixed panel is
   *  never clipped by the card's overflow/transform. */
  onMakeOffer: (listing: BuyListing) => void;
}) {
  const name = [listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
  const price = rupees(Math.round(listing.priceLakh * 100000));

  const specs: string[] = [
    String(listing.year),
    fuelLabel(listing.fuel),
    listing.transmission ?? "",
  ].filter(Boolean);

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
      </Link>

      <div className="mw-card-body">
        <h3 className="mw-card-title">
          <Link to="/buy/vehicle/$id" params={{ id: listing.id }}>
            {name}
          </Link>
        </h3>
        <p className="mw-card-price">{price}</p>
        <p className="mw-card-specs">
          {specs.map((spec, index) => (
            <span key={spec}>
              {index > 0 && <i aria-hidden="true" />}
              {spec}
            </span>
          ))}
        </p>
        <p className="mw-card-meta">
          {listing.kilometres !== null && (
            <span>{listing.kilometres.toLocaleString("en-IN")} km</span>
          )}
          <span className="mw-card-city">
            <MapPin size={12} aria-hidden="true" /> {listing.city}
          </span>
        </p>
      </div>

      <div className="mw-card-actions">
        <div className="mw-card-actions-row">
          <button
            type="button"
            className="mw-card-fav mw-card-fav--action"
            aria-label={shortlisted ? `Remove ${name} from shortlist` : `Shortlist ${name}`}
            aria-pressed={shortlisted}
            data-active={shortlisted || undefined}
            onClick={() => onToggleShortlist(listing.id)}
          >
            <Heart size={17} fill={shortlisted ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          <Link
            to="/buy/vehicle/$id"
            params={{ id: listing.id }}
            className="mw-btn mw-btn--primary"
          >
            View details
          </Link>
        </div>
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
