import { ChevronRight } from "lucide-react";
import { BUY_CATEGORY_LIST, listingCount, type BuyCategoryId } from "@/lib/buy-catalog";

/**
 * Step 1 of BUY: every category is shown before brands, filters or listings.
 * Selecting a card drives the brand rail, filters and listings below.
 */
export function BuyCategoryGrid({
  selected,
  onSelect,
}: {
  selected: BuyCategoryId | null;
  onSelect: (id: BuyCategoryId) => void;
}) {
  return (
    <section className="buy-section buy-section--categories" aria-labelledby="buy-categories-title">
      <div className="home-container">
        <div className="buy-section-head">
          <div>
            <p className="buy-kicker">
              <span>Step 1</span> Vehicle category
            </p>
            <h2 id="buy-categories-title" className="buy-section-title">
              Choose what you want to <span>buy</span>
            </h2>
            <p className="buy-section-text">
              Eight Motor Wallah categories, each with its own brands, models and listings. Pick a
              category to start — nothing is filtered down to cars only.
            </p>
          </div>
          <p className="buy-section-note">{BUY_CATEGORY_LIST.length} categories</p>
        </div>

        <div className="buy-category-grid">
          {BUY_CATEGORY_LIST.map((category, index) => {
            const active = selected === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={active}
                className="buy-category-card"
                data-active={active || undefined}
                data-size={index === 0 ? "hero" : index === 1 ? "wide" : "normal"}
              >
                <span className="buy-category-media">
                  <img
                    src={category.image}
                    alt={`${category.label} illustrative vehicle photograph`}
                    width={720}
                    height={450}
                    loading="lazy"
                  />
                  <span className="buy-category-count">{listingCount(category.id)} listings</span>
                  {active && <span className="buy-category-selected">Selected</span>}
                </span>
                <span className="buy-category-body">
                  <span className="buy-category-info">
                    <span className="buy-category-name">{category.label}</span>
                    <span className="buy-category-blurb">{category.blurb}</span>
                  </span>
                  <span className="buy-category-arrow" aria-hidden="true">
                    <ChevronRight size={16} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
