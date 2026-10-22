import { Cog, FileText, Landmark, ShieldCheck, Wrench } from "lucide-react";
import { getBuyServiceCategory, type BuyServiceListing } from "@/lib/buy-services";

const ICONS = {
  wrench: Wrench,
  cog: Cog,
  landmark: Landmark,
  shield: ShieldCheck,
  "file-text": FileText,
} as const;

/**
 * Service / partner card for Finance, Insurance, RTO and Parts categories.
 *
 * Same shell as the vehicle card (white, rounded border, red provider
 * eyebrow, bold title, large red value line) but with a tinted icon plate
 * instead of a photo — no fake partner photography — and two actions:
 * APPLY NOW (red) and ENQUIRE (white with red border).
 */
export function BuyServiceCard({
  listing,
  onApply,
  onEnquire,
}: {
  listing: BuyServiceListing;
  onApply: (listing: BuyServiceListing) => void;
  onEnquire: (listing: BuyServiceListing) => void;
}) {
  const category = getBuyServiceCategory(listing.categoryId);
  const Icon = ICONS[category?.icon ?? "wrench"] ?? Wrench;

  return (
    <article className="mw-card mw-card--service">
      <div className="mw-card-media mw-card-media--icon" aria-hidden="true">
        <span className="mw-card-iconplate">
          <Icon size={34} strokeWidth={1.6} />
        </span>
        <span className="mw-card-tags">
          <span className="mw-tag mw-tag--demo">Demo</span>
        </span>
      </div>

      <div className="mw-card-body">
        <p className="mw-card-brand">{listing.provider}</p>
        <h3 className="mw-card-title">{listing.title}</h3>
        <p className="mw-card-meta">
          <span>{listing.facts[0]}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.facts[1]}</span>
          <span aria-hidden="true">·</span>
          <span>{listing.city}</span>
        </p>
        <p className="mw-card-price">{listing.priceLabel}</p>
        <p className="mw-card-servicenote">{listing.blurb}</p>
      </div>

      <div className="mw-card-actions mw-card-actions--two">
        <button
          type="button"
          className="mw-btn mw-btn--primary"
          onClick={() => onApply(listing)}
          aria-label={`Apply now for ${listing.title}`}
        >
          Apply now
        </button>
        <button
          type="button"
          className="mw-btn mw-btn--outline"
          onClick={() => onEnquire(listing)}
          aria-label={`Enquire about ${listing.title}`}
        >
          Enquire
        </button>
      </div>
    </article>
  );
}
