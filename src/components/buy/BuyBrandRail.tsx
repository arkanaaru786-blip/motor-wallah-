import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrandArt } from "@/components/buy/BrandArt";
import type { BuyCategory } from "@/lib/buy-catalog";

/**
 * Step 2 of BUY: brand logos for the selected category only. Brands are the
 * ones that actually have a listing in that category, so a click always yields
 * results and brands never mix between unrelated categories.
 */
export function BuyBrandRail({
  category,
  brands,
  selected,
  onSelect,
}: {
  category: BuyCategory;
  brands: { brand: string; count: number }[];
  selected: string;
  onSelect: (brand: string) => void;
}) {
  return (
    <section className="buy-section buy-section--brands" aria-labelledby="buy-brands-title">
      <div className="home-container">
        <div className="buy-section-head">
          <div>
            <p className="buy-kicker">
              <span>Step 2</span> Brand
            </p>
            <h2 id="buy-brands-title" className="buy-section-title">
              {category.singular} <span>brands</span>
            </h2>
            <p className="buy-section-text">
              Only brands listed in {category.label.toLowerCase()} are shown. Choose one to narrow
              the models and listings below.
            </p>
          </div>
          <Link to={category.to} className="buy-section-link">
            Full {category.label} page <ArrowUpRight size={15} />
          </Link>
        </div>

        <div className="buy-brand-rail" role="group" aria-label={`${category.label} brands`}>
          <button
            type="button"
            onClick={() => onSelect("")}
            aria-pressed={selected === ""}
            data-active={selected === "" || undefined}
            className="buy-brand-chip buy-brand-chip--all"
          >
            <span className="buy-brand-logo-slot">
              <LayoutGrid size={20} aria-hidden="true" />
            </span>
            <span className="buy-brand-name">All brands</span>
            <span className="buy-brand-count">
              {brands.reduce((total, b) => total + b.count, 0)}
            </span>
          </button>

          {brands.map(({ brand, count }) => (
            <button
              key={brand}
              type="button"
              onClick={() => onSelect(brand)}
              aria-pressed={selected === brand}
              data-active={selected === brand || undefined}
              className="buy-brand-chip"
            >
              <span className="buy-brand-logo-slot">
                <BrandArt brand={brand} />
              </span>
              <span className="buy-brand-name">{brand.replace(/\s*\(.*?\)\s*/g, "")}</span>
              <span className="buy-brand-count">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
