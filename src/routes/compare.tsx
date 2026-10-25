import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GitCompareArrows, MessageCircle, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import {
  BUY_CATEGORY_LIST,
  buyListingName,
  getBuyCategory,
  listingsInCategory,
  rupees,
  type BuyCategoryId,
  type BuyListing,
} from "@/lib/buy-catalog";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Compare Vehicles — Side-by-Side Car & Bike Comparison | Motor Wallah";
const DESCRIPTION =
  "Pick any two Motor Wallah listings from one category and compare price, year, kilometres, fuel, transmission and location side by side, with a clear verdict.";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const view = search["view"];
    const cat = search["cat"];
    return {
      view: view === "compare" ? view : undefined,
      cat: isCategoryId(cat) ? cat : undefined,
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
  component: Page,
});

type CompareSearch = {
  /** URL-driven steps: /compare = category grid, ?view=compare = compare form. */
  view?: "compare" | undefined;
  cat?: BuyCategoryId | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

/* -------------------------------------------------------------------------- */
/* Verdict logic — simple deterministic rules, NO AI.                          */
/* Price (lower wins), Year (newer wins) and Km Driven (lower wins) each award */
/* one win. A vehicle is "clearly better" only when it wins at least 2 of the  */
/* valid criteria AND strictly more than the other; otherwise both are decent. */
/* -------------------------------------------------------------------------- */
type Verdict = {
  winner: "a" | "b" | "none";
  aWins: number;
  bWins: number;
  reasons: string[];
};

const compareVerdict = (a: BuyListing, b: BuyListing, priceA: number, priceB: number): Verdict => {
  const kmValid = a.kilometres !== null && b.kilometres !== null;
  const criteria: { key: string; aBetter: boolean; bBetter: boolean; reason: string }[] = [
    {
      key: "price",
      aBetter: priceA < priceB,
      bBetter: priceB < priceA,
      reason: "lower price",
    },
    { key: "year", aBetter: a.year > b.year, bBetter: b.year > a.year, reason: "newer year" },
    {
      key: "km",
      aBetter: kmValid && (a.kilometres ?? 0) < (b.kilometres ?? 0),
      bBetter: kmValid && (b.kilometres ?? 0) < (a.kilometres ?? 0),
      reason: "lower kilometres",
    },
  ];
  const aWins = criteria.filter((c) => c.aBetter).length;
  const bWins = criteria.filter((c) => c.bBetter).length;
  const clear = (wins: number, other: number) => wins >= 2 && wins > other;

  if (clear(aWins, bWins)) {
    return { winner: "a", aWins, bWins, reasons: criteria.filter((c) => c.aBetter).map((c) => c.reason) };
  }
  if (clear(bWins, aWins)) {
    return { winner: "b", aWins, bWins, reasons: criteria.filter((c) => c.bBetter).map((c) => c.reason) };
  }
  return { winner: "none", aWins, bWins, reasons: [] };
};

const VERDICT_ROWS: { key: string; label: string; value: (l: BuyListing, price: number) => string }[] = [
  { key: "price", label: "Price", value: (_l, price) => rupees(price) },
  { key: "year", label: "Year", value: (l) => String(l.year) },
  { key: "km", label: "Km Driven", value: (l) => (l.kilometres === null ? "Not listed" : `${l.kilometres.toLocaleString("en-IN")} km`) },
  { key: "fuel", label: "Fuel Type", value: (l) => l.fuel },
  { key: "transmission", label: "Transmission", value: (l) => l.transmission ?? "Not listed" },
  { key: "location", label: "Location", value: (l) => l.city },
];

function Page() {
  const navigate = useNavigate();
  const { view, cat } = Route.useSearch();

  const [vehicle1, setVehicle1] = useState("");
  const [vehicle2, setVehicle2] = useState("");

  const category = getBuyCategory(cat) ?? null;
  const step: "category" | "compare" = view === "compare" && category ? "compare" : "category";
  const pendingScroll = useRef<string | null>(null);

  // Deferred scroll: runs only after the step change has actually rendered.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Defensive fallback for stale compare URLs — returns to the category grid.
  useEffect(() => {
    if (view !== "compare" || category) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/compare", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, category, navigate]);

  /* Same-category options only — both dropdowns are closed lists of real
     Motor Wallah listings, so nothing custom can be typed in. */
  const options = category ? listingsInCategory(category.id) : [];
  const listingA = options.find((l) => l.id === vehicle1) ?? null;
  const listingB = options.find((l) => l.id === vehicle2) ?? null;
  const sameVehicle = Boolean(vehicle1 && vehicle1 === vehicle2);
  const showResult = Boolean(category && listingA && listingB && !sameVehicle);

  const priceA = listingA ? Math.round(listingA.priceLakh * 100000) : 0;
  const priceB = listingB ? Math.round(listingB.priceLakh * 100000) : 0;
  const verdict = showResult && listingA && listingB ? compareVerdict(listingA, listingB, priceA, priceB) : null;

  const nameA = listingA ? buyListingName(listingA) : "";
  const nameB = listingB ? buyListingName(listingB) : "";

  const pickCategory = (id: BuyCategoryId) => {
    setVehicle1("");
    setVehicle2("");
    pendingScroll.current = "compare-form";
    navigate({ to: "/compare", search: { view: "compare", cat: id } });
  };

  const backToCategories = () => {
    setVehicle1("");
    setVehicle2("");
    pendingScroll.current = "compare-categories";
    navigate({ to: "/compare", search: {} });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to compare two vehicles.");
  const stepIndex = step === "category" ? 0 : showResult ? 2 : 1;

  const sideBadge = (side: "a" | "b") => {
    if (!verdict) return null;
    if (verdict.winner === "none") {
      return (
        <span className="mw-cmp-badge" data-side={side} data-badge="good">
          Good Choice
        </span>
      );
    }
    return verdict.winner === side ? (
      <span className="mw-cmp-badge" data-side={side} data-badge="excellent">
        Excellent Vehicle
      </span>
    ) : (
      <span className="mw-cmp-badge" data-side={side} data-badge="good">
        Good Choice
      </span>
    );
  };

  /** True when `side` wins this criterion outright (ties and n/a never win). */
  const winsRow = (rowKey: string, side: "a" | "b"): boolean => {
    if (!listingA || !listingB) return false;
    if (rowKey === "price") return side === "a" ? priceA < priceB : priceB < priceA;
    if (rowKey === "year") return side === "a" ? listingA.year > listingB.year : listingB.year > listingA.year;
    if (rowKey === "km") {
      if (listingA.kilometres === null || listingB.kilometres === null) return false;
      return side === "a"
        ? listingA.kilometres < listingB.kilometres
        : listingB.kilometres < listingA.kilometres;
    }
    return false;
  };

  /** Highlight only the clear winner's winning values — never both sides. */
  const cellClass = (rowKey: string, side: "a" | "b") =>
    verdict && verdict.winner !== "none" && verdict.winner === side && winsRow(rowKey, side)
      ? "mw-cmp-cell mw-cmp-cell--better"
      : "mw-cmp-cell";

  return (
    <div id="top" className="mw-sell mw-cmp min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Compare · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Compare Vehicles <em>Side by Side</em>
            </h1>
            <p className="mw-sell-hero-text">
              Pick any two vehicles from one category and see price, year, kilometres, fuel,
              transmission and location together — with a clear, honest verdict on top.
            </p>
            <div className="mw-sell-hero-actions">
              <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Compare flow steps">
              {["Choose Category", "Pick Two Vehicles", "Comparison"].map((label, i) => (
                <span
                  key={label}
                  className={`mw-sell-step${i === stepIndex ? " mw-sell-step--active" : ""}`}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Step 1: category grid ---------------- */}
        {step === "category" && (
          <section
            id="compare-categories"
            className="mw-sell-section"
            aria-labelledby="compare-cats-title"
          >
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Choose vehicle category
              </p>
              <h2 id="compare-cats-title" className="mw-sell-title">
                What do you want to <span>compare?</span>
              </h2>
              <p className="mw-sell-text">
                Cars are compared with cars and bikes with bikes — pick a category to open the
                comparison form with two pickers from our listings.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickCategory(item.id)}
                    aria-label={`Compare ${item.singular}s`}
                  >
                    <span className="mw-sell-cat-media">
                      <img
                        src={item.image}
                        alt={`${item.label} illustrative vehicle photograph`}
                        width={720}
                        height={450}
                        loading="lazy"
                      />
                    </span>
                    <span className="mw-sell-cat-body">
                      <span className="mw-sell-cat-name">{item.label}</span>
                      <span className="mw-sell-cat-blurb">{item.blurb}</span>
                    </span>
                    <span className="mw-sell-cat-arrow" aria-hidden="true">
                      <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2+3: pickers + comparison ---------------- */}
        {step === "compare" && category && (
          <section id="compare-form" className="mw-sell-form-section" aria-labelledby="compare-form-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={backToCategories}>
                  <ArrowLeft size={14} /> Change category
                </button>
                <span className="mw-sell-chip">
                  <img src={category.image} alt="" aria-hidden="true" width={34} height={24} />
                  <span>
                    Comparing <small>{category.label}</small>
                  </span>
                </span>
              </div>

              <div className="mw-sell-form">
                <h2 id="compare-form-title" className="mw-sell-form-title">
                  Pick two <span>{category.label}</span> to compare
                </h2>
                <p className="mw-sell-form-sub">
                  Both dropdowns only contain our existing {category.label} listings — pick two
                  different vehicles to see them side by side.
                </p>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Vehicle 1 *</span>
                    <select
                      className="mw-sell-input"
                      name="vehicle1"
                      required
                      value={vehicle1}
                      onChange={(event) => setVehicle1(event.target.value)}
                    >
                      <option value="">Select first vehicle</option>
                      {options.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {buyListingName(listing)} · {rupees(Math.round(listing.priceLakh * 100000))}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Vehicle 2 *</span>
                    <select
                      className="mw-sell-input"
                      name="vehicle2"
                      required
                      value={vehicle2}
                      onChange={(event) => setVehicle2(event.target.value)}
                    >
                      <option value="">Select second vehicle</option>
                      {options.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {buyListingName(listing)} · {rupees(Math.round(listing.priceLakh * 100000))}
                        </option>
                      ))}
                    </select>
                  </label>

                  {sameVehicle && (
                    <p className="mw-cmp-hint" role="alert">
                      You picked the same vehicle twice — choose a different second vehicle to
                      compare.
                    </p>
                  )}
                </div>

                {showResult && listingA && listingB && verdict && (
                  <div
                    className="mw-cmp-result"
                    id="compare-result"
                    data-winner={verdict.winner}
                    aria-live="polite"
                  >
                    {/* Step 4 — smart recommendation (rule-based, no AI) */}
                    <div className="mw-cmp-verdict" data-winner={verdict.winner}>
                      <span className="mw-cmp-verdict-icon" aria-hidden="true">
                        <GitCompareArrows size={18} />
                      </span>
                      <div>
                        <p className="mw-cmp-verdict-title">
                          {verdict.winner === "none"
                            ? "Good Choice — both are decent"
                            : verdict.winner === "a"
                              ? `Excellent Vehicle — ${nameA}`
                              : `Excellent Vehicle — ${nameB}`}
                        </p>
                        <p className="mw-cmp-verdict-text">
                          {verdict.winner === "none"
                            ? `Neither is clearly ahead on the numbers (${verdict.aWins}–${verdict.bWins} on price, year and kilometres) — either is a good pick.`
                            : `${verdict.winner === "a" ? nameA : nameB} wins on ${verdict.reasons.join(", ")} (${verdict.aWins}–${verdict.bWins} on price, year and kilometres).`}
                        </p>
                      </div>
                    </div>

                    {/* Side-by-side bento comparison table */}
                    <div className="mw-cmp-table" role="table" aria-label={`${nameA} versus ${nameB}`}>
                      <div className="mw-cmp-headrow" role="row">
                        <span className="mw-cmp-headcell mw-cmp-headcell--label" role="columnheader">
                          Vehicle
                        </span>
                        {(
                          [
                            { side: "a" as const, listing: listingA, price: priceA, name: nameA },
                            { side: "b" as const, listing: listingB, price: priceB, name: nameB },
                          ]
                        ).map((col) => (
                          <span
                            key={col.side}
                            className="mw-cmp-headcell"
                            role="columnheader"
                            data-side={col.side}
                            data-winner={verdict.winner === col.side ? col.side : undefined}
                          >
                            {sideBadge(col.side)}
                            <span className="mw-cmp-card">
                              <img
                                src={col.listing.images[0]}
                                alt={col.listing.photoAlt}
                                width={320}
                                height={200}
                                loading="lazy"
                              />
                              <span className="mw-cmp-card-name">{col.name}</span>
                              <span className="mw-cmp-card-price">{rupees(col.price)}</span>
                            </span>
                          </span>
                        ))}
                      </div>

                      {VERDICT_ROWS.map((row) => (
                        <div className="mw-cmp-row" role="row" key={row.key}>
                          <span className="mw-cmp-label" role="rowheader">
                            {row.label}
                          </span>
                          <span className={cellClass(row.key, "a")} role="cell" data-side="a">
                            {row.value(listingA, priceA)}
                          </span>
                          <span className={cellClass(row.key, "b")} role="cell" data-side="b">
                            {row.value(listingB, priceB)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="mw-cmp-note">
                      Verdict is a simple comparison of price, year and kilometres on our live
                      listing data — no AI involved, and an in-person inspection always decides
                      the final call.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
