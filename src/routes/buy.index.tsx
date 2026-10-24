import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeInfo, Heart, Info, SearchX } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { EnquiryDialog, type EnquiryField } from "@/components/site/EnquiryDialog";
import { BuyHub } from "@/components/buy/BuyHub";
import {
  BuyServiceSidebar,
  type BuyServiceFilters,
} from "@/components/buy/BuySidebar";
import {
  BuyFilterBar,
  BuyActiveFilters,
  type BuyFilters,
} from "@/components/buy/BuyFilterBar";
import { BuyBrandRail } from "@/components/buy/BuyBrandRail";
import { BuyListingCard } from "@/components/buy/BuyListingCard";
import { BuyServiceCard } from "@/components/buy/BuyServiceCard";
import { MakeOfferDialog } from "@/components/buy/MakeOfferDialog";
import {
  BUY_CATEGORY_LIST,
  BUY_YEAR_MAX,
  BUY_YEAR_MIN,
  brandTilesFor,
  catalogModelsFor,
  citiesInCategory,
  fuelOptionsFor,
  getBuyCategory,
  listingsInCategory,
  priceBounds,
  type BuyCategoryId,
  type BuyListing,
} from "@/lib/buy-catalog";
import {
  getBuyServiceCategory,
  isBuyServiceId,
  serviceCitiesInCategory,
  serviceListingsInCategory,
  serviceOptionsInCategory,
  servicePriceBounds,
  serviceListingName,
  type BuyServiceId,
  type BuyServiceListing,
} from "@/lib/buy-services";
import { useShortlist } from "@/lib/shortlist";
import type { LeadType } from "@/lib/leads";

const TITLE = "Buy Pre-Owned Vehicles — Cars, Bikes, Trucks & Tractors | Motor Wallah";
const DESCRIPTION =
  "Buy used cars, bikes, 3-wheelers, SCVs, trucks, buses, tractors and commercial taxis with category, brand, budget, year, location and fuel filters on Motor Wallah. Also browse parts, finance, insurance and RTO services.";

type BuySearch = {
  category?: BuyCategoryId | undefined;
  service?: BuyServiceId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

export const Route = createFileRoute("/buy/")({
  validateSearch: (search: Record<string, unknown>): BuySearch => ({
    // Category and service are mutually exclusive — a category wins if both
    // somehow arrive in the URL.
    category: isCategoryId(search["category"]) ? search["category"] : undefined,
    service:
      !isCategoryId(search["category"]) && isBuyServiceId(search["service"])
        ? search["service"]
        : undefined,
  }),
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
  component: BuyPage,
});

const defaultFilters = (min = 0, max = 0): BuyFilters => ({
  brand: "",
  model: "",
  fuels: [],
  city: "",
  price: [min, max],
  yearMin: BUY_YEAR_MIN,
  yearMax: BUY_YEAR_MAX,
  verifiedOnly: false,
});

/**
 * The five fuel checkboxes from the reference filter bar are always offered;
 * extra fuels that actually occur in a category's records (e.g. LPG) are
 * appended after them.
 */
const BASE_FUELS = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

const defaultServiceFilters = (min = 0, max = 0): BuyServiceFilters => ({
  query: "",
  option: "",
  city: "",
  price: [min, max],
});

/** Which lead type each service category submits (no backend — local queue). */
const SERVICE_LEAD_TYPES: Record<BuyServiceId, LeadType> = {
  "parts-new": "general_enquiry",
  "parts-used": "general_enquiry",
  finance: "finance_enquiry",
  insurance: "insurance_enquiry",
  rto: "general_enquiry",
};

const matchesServiceSearch = (listing: BuyServiceListing, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [listing.title, listing.provider, listing.option, listing.city, listing.blurb]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

function BuyPage() {
  const { category: categoryParam, service: serviceParam } = Route.useSearch();
  const navigate = useNavigate();
  const category = getBuyCategory(categoryParam) ?? null;
  const service = getBuyServiceCategory(serviceParam) ?? null;
  const categoryId = category?.id ?? null;
  const serviceId = service?.id ?? null;
  const shortlist = useShortlist();

  const bounds = useMemo(
    () =>
      categoryId
        ? priceBounds(categoryId)
        : serviceId
          ? servicePriceBounds(serviceId)
          : { min: 0, max: 0, step: 5000 },
    [categoryId, serviceId],
  );

  const [filters, setFilters] = useState<BuyFilters>(() => defaultFilters());
  const [serviceFilters, setServiceFilters] = useState<BuyServiceFilters>(() =>
    defaultServiceFilters(),
  );
  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [offerListing, setOfferListing] = useState<BuyListing | null>(null);
  const [serviceEnquiry, setServiceEnquiry] = useState<{
    listing: BuyServiceListing;
    mode: "apply" | "enquire";
  } | null>(null);
  const shouldScroll = useRef(false);

  // Every category gets a clean filter state and its own price range.
  useEffect(() => {
    setFilters(defaultFilters(bounds.min, bounds.max));
    setShortlistedOnly(false);
  }, [categoryId, bounds.min, bounds.max]);

  useEffect(() => {
    setServiceFilters(defaultServiceFilters(bounds.min, bounds.max));
  }, [serviceId, bounds.min, bounds.max]);

  useEffect(() => {
    if ((!categoryId && !serviceId) || !shouldScroll.current) return;
    shouldScroll.current = false;
    const target = document.getElementById("buy-browse");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [categoryId, serviceId]);

  /* ---------------------------------------------------------------- */
  /* Vehicle category state                                            */
  /* ---------------------------------------------------------------- */
  const brands = useMemo(() => (categoryId ? brandTilesFor(categoryId) : []), [categoryId]);
  // Full catalogue per brand — includes discontinued models (Maruti Zen,
  // Esteem, Bajaj Discover …) that have no live listing right now.
  const models = useMemo(
    () => (categoryId ? catalogModelsFor(categoryId, filters.brand || undefined) : []),
    [categoryId, filters.brand],
  );
  const fuels = useMemo(() => {
    if (!categoryId) return [];
    const derived = fuelOptionsFor(
      categoryId,
      filters.brand || undefined,
      filters.model || undefined,
    );
    return Array.from(new Set([...BASE_FUELS, ...derived]));
  }, [categoryId, filters.brand, filters.model]);
  const cities = useMemo(() => (categoryId ? citiesInCategory(categoryId) : []), [categoryId]);

  // Keep model/fuel selections valid when the brand or model changes.
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      if (next.brand && !brands.some((b) => b.brand === next.brand)) next.brand = "";
      if (next.model && !models.includes(next.model)) next.model = "";
      const keptFuels = next.fuels.filter((fuel) => fuels.includes(fuel));
      next.fuels = keptFuels.length === next.fuels.length ? next.fuels : keptFuels;
      return next.brand === prev.brand &&
        next.model === prev.model &&
        next.fuels === prev.fuels
        ? prev
        : next;
    });
  }, [brands, models, fuels]);

  const results = useMemo(() => {
    if (!categoryId) return [];
    const [low, high] = filters.price;
    return listingsInCategory(categoryId)
      .filter((listing) => !filters.brand || listing.brand === filters.brand)
      .filter((listing) => !filters.model || listing.model === filters.model)
      .filter(
        (listing) => filters.fuels.length === 0 || filters.fuels.includes(listing.fuel),
      )
      .filter((listing) => !filters.city || listing.city === filters.city)
      .filter((listing) => listing.year >= filters.yearMin && listing.year <= filters.yearMax)
      .filter((listing) => {
        const amount = Math.round(listing.priceLakh * 100000);
        return amount >= low && amount <= high;
      })
      .filter((listing) => !filters.verifiedOnly || listing.verified)
      .filter((listing) => !shortlistedOnly || shortlist.ids.includes(listing.id))
      .sort((a, b) => b.year - a.year || a.priceLakh - b.priceLakh);
  }, [categoryId, filters, shortlistedOnly, shortlist.ids]);

  const activeCount = categoryId
    ? [
        Boolean(filters.brand),
        Boolean(filters.model),
        filters.fuels.length > 0,
        Boolean(filters.city),
        filters.price[0] !== bounds.min || filters.price[1] !== bounds.max,
        filters.yearMin !== BUY_YEAR_MIN || filters.yearMax !== BUY_YEAR_MAX,
        filters.verifiedOnly,
      ].filter(Boolean).length
    : 0;

  /* ---------------------------------------------------------------- */
  /* Service category state                                            */
  /* ---------------------------------------------------------------- */
  const serviceOptions = useMemo(
    () => (serviceId ? serviceOptionsInCategory(serviceId) : []),
    [serviceId],
  );
  const serviceCityList = useMemo(
    () => (serviceId ? serviceCitiesInCategory(serviceId) : []),
    [serviceId],
  );

  const serviceResults = useMemo(() => {
    if (!serviceId) return [];
    const [low, high] = serviceFilters.price;
    return serviceListingsInCategory(serviceId)
      .filter((listing) => matchesServiceSearch(listing, serviceFilters.query))
      .filter((listing) => !serviceFilters.option || listing.option === serviceFilters.option)
      .filter((listing) => !serviceFilters.city || listing.city === serviceFilters.city)
      .filter((listing) => listing.priceValue >= low && listing.priceValue <= high);
  }, [serviceId, serviceFilters]);

  const serviceActiveCount = serviceId
    ? [
        Boolean(serviceFilters.query),
        Boolean(serviceFilters.option),
        Boolean(serviceFilters.city),
        serviceFilters.price[0] !== bounds.min || serviceFilters.price[1] !== bounds.max,
      ].filter(Boolean).length
    : 0;

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */
  const selectCategory = (id: BuyCategoryId) => {
    shouldScroll.current = true;
    navigate({ to: "/buy", search: { category: id, service: undefined }, replace: true });
  };

  const selectService = (id: BuyServiceId) => {
    shouldScroll.current = true;
    navigate({ to: "/buy", search: { category: undefined, service: id }, replace: true });
  };

  const patch = (next: Partial<BuyFilters>) => setFilters((prev) => ({ ...prev, ...next }));
  const clearAll = () => {
    setFilters(defaultFilters(bounds.min, bounds.max));
    setShortlistedOnly(false);
  };

  const patchService = (next: Partial<BuyServiceFilters>) =>
    setServiceFilters((prev) => ({ ...prev, ...next }));
  const clearService = () => setServiceFilters(defaultServiceFilters(bounds.min, bounds.max));

  const countLabel = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
  const showHub = !category && !service;

  const enquiryCategory = serviceEnquiry
    ? getBuyServiceCategory(serviceEnquiry.listing.categoryId)
    : null;
  const enquiryFields: EnquiryField[] = [
    { name: "name", label: "Your name", required: true },
    { name: "mobile", label: "Mobile number", type: "tel", required: true },
    { name: "city", label: "City", required: true },
    {
      name: "message",
      label: "Message (optional)",
      type: "textarea",
    },
  ];

  return (
    <div className="mw-buy min-h-screen pb-16 md:pb-0">
      <SiteHeader pills />
      <main>
        {showHub ? (
          <>
            <section className="mw-buy-hero">
              <div className="home-container mw-buy-hero-inner">
                <div>
                  <p className="mw-buy-hero-kicker">
                    <span aria-hidden="true" /> Buy · Motor Wallah marketplace
                  </p>
                  <h1 className="mw-buy-hero-title">
                    Every vehicle. <em>One marketplace.</em>
                  </h1>
                  <p className="mw-buy-hero-text">
                    Find the right vehicle, at the right price, with complete trust.
                  </p>
                  <div className="mw-buy-hero-cta">
                    <a href="#mw-hub" className="mw-buy-hero-btn mw-buy-hero-btn--primary">
                      Buy Vehicles
                    </a>
                    <Link to="/sell-your-car" className="mw-buy-hero-btn mw-buy-hero-btn--ghost">
                      Sell Vehicle
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <BuyHub onSelectCategory={selectCategory} onSelectService={selectService} />
          </>
        ) : (
          <div className="home-container" id="buy-browse">
            <div
              className={
                category ? "mw-buy-layout mw-buy-layout--flow" : "mw-buy-layout"
              }
            >
              {service ? (
                <BuyServiceSidebar
                  service={service}
                  countLabel={countLabel(
                    serviceListingsInCategory(service.id).length,
                    "demo listing",
                  )}
                  filters={serviceFilters}
                  options={serviceOptions}
                  cities={serviceCityList}
                  bounds={bounds}
                  activeCount={serviceActiveCount}
                  onBack={() => navigate({ to: "/buy", search: {}, replace: true })}
                  onChange={patchService}
                  onClear={clearService}
                />
              ) : null}

              <div className="mw-buy-main">
                {category && (
                  <div className="mw-buy-flow">
                    <BuyBrandRail
                      category={category}
                      brands={brands}
                      selected={filters.brand}
                      onSelect={(brand) => patch({ brand, model: "" })}
                      onBack={() => navigate({ to: "/buy", search: {}, replace: true })}
                    />
                    <div className="mw-buy-filter-sticky">
                      <BuyFilterBar
                        filters={filters}
                        brands={brands}
                        models={models}
                        fuels={fuels}
                        cities={cities}
                        bounds={bounds}
                        activeCount={activeCount}
                        onChange={patch}
                        onClear={clearAll}
                      />
                      <BuyActiveFilters
                        filters={filters}
                        bounds={bounds}
                        brands={brands}
                        onChange={patch}
                        onClear={clearAll}
                      />
                    </div>
                  </div>
                )}
                {service && (
                  <div className="mw-service-banner">
                    <BadgeInfo size={16} aria-hidden="true" />
                    <p>{service.disclaimer}</p>
                  </div>
                )}

                <div className="mw-results-head">
                  <div>
                    <h1 className="mw-results-title">
                      {service ? service.label : `${category?.label ?? ""} listings`}
                    </h1>
                    <p className="mw-results-note">
                      <Info size={13} aria-hidden="true" />{" "}
                      {service
                        ? `${serviceResults.length} of ${serviceListingsInCategory(service.id).length} demo records — partners and pricing are illustrative.`
                        : "Demo catalogue records from the project datasets — not confirmed Motor Wallah inventory."}
                    </p>
                  </div>
                  {!service && (
                    <div className="mw-results-actions">
                      <button
                        type="button"
                        className="mw-shortlist-toggle"
                        aria-pressed={shortlistedOnly}
                        data-active={shortlistedOnly || undefined}
                        onClick={() => setShortlistedOnly((value) => !value)}
                      >
                        <Heart
                          size={14}
                          fill={shortlistedOnly ? "currentColor" : "none"}
                          aria-hidden="true"
                        />
                        Shortlisted · {shortlist.ids.length}
                      </button>
                      {category && (
                        <>
                          <Link to="/buy/offers" className="mw-results-link">
                            My Offers
                          </Link>
                          <Link to={category.to} className="mw-results-link">
                            Open {category.label} page
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {service ? (
                  serviceResults.length === 0 ? (
                    <div className="mw-empty">
                      <SearchX size={26} aria-hidden="true" />
                      <p className="mw-empty-title">
                        No {service.label.toLowerCase()} match these filters
                      </p>
                      <p className="mw-empty-text">
                        Try widening the budget, clearing the {service.optionLabel.toLowerCase()} or
                        choosing all cities.
                      </p>
                      <button
                        type="button"
                        onClick={clearService}
                        className="mw-btn mw-btn--primary"
                      >
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <div className="mw-bento">
                      {serviceResults.map((listing) => (
                        <BuyServiceCard
                          key={listing.id}
                          listing={listing}
                          onApply={(l) => setServiceEnquiry({ listing: l, mode: "apply" })}
                          onEnquire={(l) => setServiceEnquiry({ listing: l, mode: "enquire" })}
                        />
                      ))}
                    </div>
                  )
                ) : category ? (
                  results.length === 0 ? (
                    <div className="mw-empty">
                      <SearchX size={26} aria-hidden="true" />
                      <p className="mw-empty-title">
                        No {category.label.toLowerCase()} match these filters
                      </p>
                      {filters.verifiedOnly ? (
                        <p className="mw-empty-text">
                          No listing in this category has a completed Motor Wallah inspection yet,
                          so nothing can honestly be shown as verified. Clear the verified filter to
                          see demo listings.
                        </p>
                      ) : shortlistedOnly ? (
                        <p className="mw-empty-text">
                          You have not shortlisted any {category.label.toLowerCase()} listing yet.
                          Tap the heart on a listing to save it on this device.
                        </p>
                      ) : filters.brand &&
                        !brands.some((b) => b.brand === filters.brand && b.count > 0) ? (
                        <p className="mw-empty-text">
                          There are no {category.label.toLowerCase()} demo listings for{" "}
                          {filters.brand} right now — clear the brand filter to see the other brands
                          in this category.
                        </p>
                      ) : filters.model ? (
                        <p className="mw-empty-text">
                          The selected model ({filters.model}) includes discontinued names from the
                          catalogue, and none has a live demo listing right now — pick another model
                          or clear the filters.
                        </p>
                      ) : (
                        <p className="mw-empty-text">
                          Try widening the budget or year range, or clear the brand and fuel
                          filters.
                        </p>
                      )}
                      <button type="button" onClick={clearAll} className="mw-btn mw-btn--primary">
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <div className="mw-bento">
                      {results.map((listing, index) => (
                        <BuyListingCard
                          key={listing.id}
                          listing={listing}
                          featured={index === 0 && results.length >= 3}
                          shortlisted={shortlist.ids.includes(listing.id)}
                          onToggleShortlist={shortlist.toggle}
                          onMakeOffer={setOfferListing}
                        />
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
      {offerListing && (
        <MakeOfferDialog listing={offerListing} open onClose={() => setOfferListing(null)} />
      )}
      {serviceEnquiry && enquiryCategory && (
        <EnquiryDialog
          open
          onClose={() => setServiceEnquiry(null)}
          title={serviceEnquiry.mode === "apply" ? "Apply now" : "Enquire"}
          subtitle={serviceListingName(serviceEnquiry.listing)}
          fields={enquiryFields}
          submitLabel={serviceEnquiry.mode === "apply" ? "Submit application" : "Send enquiry"}
          leadType={SERVICE_LEAD_TYPES[serviceEnquiry.listing.categoryId]}
          source={`buy_service_${serviceEnquiry.mode}`}
          subject={{
            id: serviceEnquiry.listing.id,
            name: serviceListingName(serviceEnquiry.listing),
            location: serviceEnquiry.listing.city,
          }}
          disclaimer={enquiryCategory.disclaimer}
        />
      )}
    </div>
  );
}
