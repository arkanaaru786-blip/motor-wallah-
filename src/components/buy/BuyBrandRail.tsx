import { useRef } from "react";
import { ArrowLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { BrandArt } from "@/components/buy/BrandArt";
import type { BuyCategory } from "@/lib/buy-catalog";

/**
 * Step 2 of BUY (reference screen 2): "← Back to Categories", the selected
 * category title and a horizontally scrollable rail of brand LOGO cards
 * specific to that category. Brands come from the category's own catalogue,
 * so a click always lands on that category's models and listings — brands
 * never leak between unrelated categories.
 */
export function BuyBrandRail({
  category,
  brands,
  selected,
  onSelect,
  onBack,
}: {
  category: BuyCategory;
  brands: { brand: string; count: number }[];
  selected: string;
  onSelect: (brand: string) => void;
  onBack: () => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollRail = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(220, rail.clientWidth * 0.6), behavior: "smooth" });
  };

  const total = brands.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="buy-rail-section" aria-labelledby="buy-rail-title">
      <div className="buy-rail-head">
        <button type="button" className="buy-rail-back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Categories
        </button>
        <h2 id="buy-rail-title" className="buy-rail-title">
          {category.label}
        </h2>
        <p className="buy-rail-sub">Select Brand</p>
      </div>

      <div className="buy-rail-wrap">
        <div className="buy-brand-rail" role="group" aria-label={`${category.label} brands`} ref={railRef}>
          <button
            type="button"
            onClick={() => onSelect("")}
            aria-pressed={selected === ""}
            data-active={selected === "" || undefined}
            className="buy-brand-chip buy-brand-chip--all"
          >
            <span className="buy-brand-logo-slot">
              <LayoutGrid size={22} aria-hidden="true" />
            </span>
            <span className="buy-brand-name">All</span>
            <span className="buy-brand-count">{total}</span>
          </button>

          {brands.map(({ brand, count }) => (
            <button
              key={brand}
              type="button"
              onClick={() => onSelect(brand)}
              aria-pressed={selected === brand}
              data-active={selected === brand || undefined}
              className="buy-brand-chip"
              title={count > 0 ? `${brand} — ${count} listings` : `${brand} — no listings yet`}
            >
              <span className="buy-brand-logo-slot">
                <BrandArt brand={brand} />
              </span>
              <span className="buy-brand-name">{brand.replace(/\s*\(.*?\)\s*/g, "")}</span>
              <span className="buy-brand-count">{count > 0 ? `${count} listed` : "Catalogue"}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="buy-rail-next"
          aria-label="Scroll to more brands"
          onClick={() => scrollRail(1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
