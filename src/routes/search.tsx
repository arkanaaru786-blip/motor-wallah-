import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Cog, FilterX, SearchX, SlidersHorizontal, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SmartSearch } from "@/components/site/SmartSearch";
import { BuyListingCard } from "@/components/buy/BuyListingCard";
import { MakeOfferDialog } from "@/components/buy/MakeOfferDialog";
import { useShortlist } from "@/lib/shortlist";
import { rupees, type BuyListing } from "@/lib/buy-catalog";
import { searchDecor, searchParts, searchVehicles } from "@/lib/smart-search";

const TITLE = "Search results | Motor Wallah";
const DESCRIPTION =
  "Search Motor Wallah for cars, bikes, three-wheelers, commercial vehicles, tractors, auto parts and vehicle decor — with brand, price and year filters.";

type SearchType = "all" | "vehicles" | "parts" | "decor";

type SearchPageParams = {
  q?: string | undefined;
  type?: SearchType | undefined;
  brand?: string | undefined;
  priceMax?: number | undefined;
  yearMin?: number | undefined;
};

const TYPE_VALUES: SearchType[] = ["all", "vehicles", "parts", "decor"];

const positiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
};

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchPageParams => {
    const type = search["type"];
    return {
      q: typeof search["q"] === "string" ? search["q"].slice(0, 80) : undefined,
      type: TYPE_VALUES.includes(type as SearchType) ? (type as SearchType) : undefined,
      brand:
        typeof search["brand"] === "string" && search["brand"].trim() ? search["brand"] : undefined,
      priceMax: positiveNumber(search["priceMax"]),
      yearMin: positiveNumber(search["yearMin"]),
    };
  },
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
  component: SearchPage,
});

const PRICE_OPTIONS = [
  { value: 0, label: "Any price" },
  { value: 500000, label: "Under ₹5 lakh" },
  { value: 1000000, label: "Under ₹10 lakh" },
  { value: 2000000, label: "Under ₹20 lakh" },
  { value: 3500000, label: "Under ₹35 lakh" },
  { value: 5000000, label: "Under ₹50 lakh" },
];

const YEAR_OPTIONS = [
  { value: 0, label: "Any year" },
  { value: 2015, label: "2015 or newer" },
  { value: 2018, label: "2018 or newer" },
  { value: 2020, label: "2020 or newer" },
  { value: 2022, label: "2022 or newer" },
];

const TYPE_TABS: { id: SearchType; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "vehicles", label: "Vehicles" },
  { id: "parts", label: "Auto Parts" },
  { id: "decor", label: "Decor" },
];

const QUICK_SEARCHES = ["Swift", "Tata", "Bikes", "Brake pads", "Seat covers"];

function SearchPage() {
  const { q = "", type = "all", brand = "", priceMax = 0, yearMin = 0 } = Route.useSearch();
  const navigate = useNavigate();
  const shortlist = useShortlist();
  const [offerListing, setOfferListing] = useState<BuyListing | null>(null);
  const term = q.trim();

  const vehicles = useMemo(() => (term ? searchVehicles(term) : []), [term]);
  const parts = useMemo(() => (term ? searchParts(term) : []), [term]);
  const decor = useMemo(() => (term ? searchDecor(term) : []), [term]);

  const brands = useMemo(
    () => Array.from(new Set(vehicles.map((hit) => hit.listing.brand))).sort(),
    [vehicles],
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((hit) => {
        const listing = hit.listing;
        if (brand && listing.brand !== brand) return false;
        if (priceMax > 0 && Math.round(listing.priceLakh * 100000) > priceMax) return false;
        if (yearMin > 0 && listing.year < yearMin) return false;
        return true;
      }),
    [vehicles, brand, priceMax, yearMin],
  );

  const showVehicles = type === "all" || type === "vehicles";
  const showParts = type === "all" || type === "parts";
  const showDecor = type === "all" || type === "decor";

  const visibleParts = showParts ? parts : [];
  const visibleDecor = showDecor ? decor : [];
  const total =
    (showVehicles ? filteredVehicles.length : 0) + visibleParts.length + visibleDecor.length;
  const activeFilters = [brand !== "", priceMax > 0, yearMin > 0].filter(Boolean).length;

  const countBreakdown = [
    showVehicles
      ? `${filteredVehicles.length} vehicle${filteredVehicles.length === 1 ? "" : "s"}`
      : null,
    showParts ? `${visibleParts.length} auto part${visibleParts.length === 1 ? "" : "s"}` : null,
    showDecor ? `${visibleDecor.length} decor item${visibleDecor.length === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const patch = (next: Partial<SearchPageParams>) =>
    navigate({
      to: "/search",
      replace: true,
      search: {
        q: term || undefined,
        type: type === "all" ? undefined : type,
        brand: brand || undefined,
        priceMax: priceMax || undefined,
        yearMin: yearMin || undefined,
        ...next,
      },
    });

  const clearFilters = () => patch({ brand: undefined, priceMax: undefined, yearMin: undefined });

  return (
    <div className="mw-buy mw-srch min-h-screen pb-16 md:pb-0" data-testid="search-page">
      <SiteHeader pills />
      <main>
        <section className="mw-srch-hero">
          <div className="home-container">
            <p className="mw-srch-kicker">
              <span aria-hidden="true" /> Smart search · Motor Wallah
            </p>
            <h1 className="mw-srch-title" data-testid="search-heading">
              {term ? (
                <>
                  Showing results for <em>“{term}”</em>
                </>
              ) : (
                <>Search every vehicle, part and decor item</>
              )}
            </h1>
            <div className="mw-srch-form">
              <SmartSearch
                variant="page"
                initialQuery={term}
                ariaLabel="Search vehicles, auto parts and decor"
              />
            </div>
            {term && (
              <p className="mw-srch-count" data-testid="search-count">
                {total} {total === 1 ? "match" : "matches"} · {countBreakdown}
              </p>
            )}
            {!term && (
              <ul className="mw-srch-quick">
                {QUICK_SEARCHES.map((item) => (
                  <li key={item}>
                    <Link to="/search" search={{ q: item }}>
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {!term ? (
          <div className="home-container">
            <div className="mw-srch-prompt" data-testid="search-prompt">
              <SearchX size={26} aria-hidden="true" />
              <p className="mw-empty-title">Start typing to search the marketplace</p>
              <p className="mw-empty-text">
                Vehicles match on brand and model, auto parts and decor match on the part name —
                typos are fine.
              </p>
              <div className="mw-srch-prompt-links">
                <Link to="/buy" className="mw-btn mw-btn--primary">
                  Browse vehicles <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link to="/accessories" className="mw-btn mw-btn--outline">
                  Auto parts
                </Link>
                <Link to="/decor" className="mw-btn mw-btn--outline">
                  Vehicle decor
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="home-container mw-srch-layout">
            <aside className="mw-srch-filters" aria-label="Refine search results">
              <div className="mw-srch-filter-head">
                <span>
                  <SlidersHorizontal size={14} aria-hidden="true" /> Filters
                </span>
                {activeFilters > 0 && <strong>{activeFilters}</strong>}
              </div>

              <label className="mw-srch-field">
                <span>Brand</span>
                <select
                  data-testid="search-filter-brand"
                  value={brand}
                  onChange={(event) => patch({ brand: event.target.value || undefined })}
                >
                  <option value="">All brands</option>
                  {brands.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mw-srch-field">
                <span>Price</span>
                <select
                  data-testid="search-filter-price"
                  value={String(priceMax)}
                  onChange={(event) => patch({ priceMax: Number(event.target.value) || undefined })}
                >
                  {PRICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mw-srch-field">
                <span>Year</span>
                <select
                  data-testid="search-filter-year"
                  value={String(yearMin)}
                  onChange={(event) => patch({ yearMin: Number(event.target.value) || undefined })}
                >
                  {YEAR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="mw-srch-clear"
                data-testid="search-clear-filters"
                onClick={clearFilters}
                disabled={activeFilters === 0}
              >
                <FilterX size={13} aria-hidden="true" /> Clear filters
              </button>

              <div className="mw-srch-types" role="group" aria-label="Result type">
                {TYPE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid="search-type"
                    data-type={tab.id}
                    aria-pressed={type === tab.id}
                    className={`mw-srch-type${type === tab.id ? " is-active" : ""}`}
                    onClick={() => patch({ type: tab.id === "all" ? undefined : tab.id })}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="mw-srch-main">
              {total === 0 && (
                <div className="mw-empty mw-srch-empty" data-testid="search-empty">
                  <SearchX size={26} aria-hidden="true" />
                  <p className="mw-empty-title">No results found for “{term}”.</p>
                  <p className="mw-empty-text">Try searching for Cars, Bikes, or Auto Parts.</p>
                  <Link to="/" className="mw-btn mw-btn--primary">
                    Back to homepage
                  </Link>
                </div>
              )}

              {showVehicles && filteredVehicles.length > 0 && (
                <section className="mw-srch-block" aria-labelledby="search-vehicles-title">
                  <header className="mw-srch-block-head">
                    <h2 id="search-vehicles-title">
                      Vehicles <span>{filteredVehicles.length}</span>
                    </h2>
                    {vehicles.length > 0 && (
                      <Link to="/buy" className="mw-results-link">
                        Browse all vehicles
                      </Link>
                    )}
                  </header>
                  <div className="mw-bento" data-testid="search-results">
                    {filteredVehicles.map(({ listing }, index) => (
                      <BuyListingCard
                        key={listing.id}
                        listing={listing}
                        featured={index === 0 && filteredVehicles.length >= 3}
                        shortlisted={shortlist.ids.includes(listing.id)}
                        onToggleShortlist={shortlist.toggle}
                        onMakeOffer={setOfferListing}
                      />
                    ))}
                  </div>
                </section>
              )}

              {showVehicles && vehicles.length > 0 && filteredVehicles.length === 0 && (
                <div className="mw-empty" data-testid="search-filtered-empty">
                  <SearchX size={26} aria-hidden="true" />
                  <p className="mw-empty-title">No vehicles match these filters</p>
                  <p className="mw-empty-text">
                    {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} match “{term}”
                    before filtering — widen the price or year, or clear the brand.
                  </p>
                  <button type="button" className="mw-btn mw-btn--primary" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}

              {showParts && visibleParts.length > 0 && (
                <section className="mw-srch-block" aria-labelledby="search-parts-title">
                  <header className="mw-srch-block-head">
                    <h2 id="search-parts-title">
                      Auto parts <span>{visibleParts.length}</span>
                    </h2>
                    <Link to="/accessories" className="mw-results-link">
                      Open parts store
                    </Link>
                  </header>
                  <div className="mw-srch-cards" data-testid="search-parts">
                    {visibleParts.map((part) => (
                      <article className="mw-srch-part" key={part.id}>
                        <span className="mw-srch-part-icon" aria-hidden="true">
                          <Cog size={18} />
                        </span>
                        <div className="mw-srch-part-copy">
                          <h3>{part.name}</h3>
                          <p>
                            {part.categoryLabel} · {rupees(part.min)} – {rupees(part.max)}
                          </p>
                        </div>
                        <Link to="/accessories" className="mw-btn mw-btn--outline">
                          Shop part
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {showDecor && visibleDecor.length > 0 && (
                <section className="mw-srch-block" aria-labelledby="search-decor-title">
                  <header className="mw-srch-block-head">
                    <h2 id="search-decor-title">
                      Vehicle decor <span>{visibleDecor.length}</span>
                    </h2>
                    <Link to="/decor" className="mw-results-link">
                      Open decor store
                    </Link>
                  </header>
                  <div className="mw-srch-cards" data-testid="search-decor">
                    {visibleDecor.map((item) => (
                      <article className="mw-srch-part" key={item.id}>
                        <span className="mw-srch-part-icon" aria-hidden="true">
                          <Sparkles size={18} />
                        </span>
                        <div className="mw-srch-part-copy">
                          <h3>{item.name}</h3>
                          <p>
                            {item.categoryLabel} · {rupees(item.min)} – {rupees(item.max)}
                          </p>
                        </div>
                        <Link to="/decor" className="mw-btn mw-btn--outline">
                          Shop decor
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
      {offerListing && (
        <MakeOfferDialog listing={offerListing} open onClose={() => setOfferListing(null)} />
      )}
    </div>
  );
}
