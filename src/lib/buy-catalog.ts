/**
 * Unified BUY marketplace catalogue.
 *
 * This module does NOT invent a second inventory: it composes the existing
 * datasets into one shape the BUY page can filter.
 *
 *   Cars  -> src/lib/cars-data.ts (VEHICLES) + src/lib/vehicle-catalog.ts
 *   Others-> src/lib/vehicle-categories.ts (CATEGORIES / CATEGORY_LISTINGS)
 *
 * Every category keeps its own Brand -> Model catalogue, so models can never
 * leak between unrelated vehicle categories.
 */
// Studio vehicle photographs already used by the homepage category explorer.
// They frame the vehicle properly, unlike the older letterboxed category crops.
import carCategoryImage from "@/assets/homepage/Car.png";
import bikeCategoryImage from "@/assets/homepage/Bike.png";
import threeWheelerCategoryImage from "@/assets/homepage/3 wheeler.png";
import scvCategoryImage from "@/assets/homepage/SCV.png";
import truckCategoryImage from "@/assets/homepage/Truck.png";
import busCategoryImage from "@/assets/homepage/Bus.png";
import tractorCategoryImage from "@/assets/homepage/Tractor.png";
import taxiCategoryImage from "@/assets/homepage/Taxi.png";
import { VEHICLES, placeholderFor } from "@/lib/cars-data";
import {
  EXTRA_DEMO_CARS,
  EXTRA_DEMO_LISTINGS,
} from "@/lib/buy-demo-inventory";
import { modelsForBrand, BRAND_NAMES } from "@/lib/vehicle-catalog";
import { hasBrandLogo } from "@/components/buy/BrandArt";
import {
  CATEGORIES,
  CATEGORY_LISTINGS,
  type CategoryId as NonCarCategoryId,
} from "@/lib/vehicle-categories";

export type BuyCategoryId = "cars" | NonCarCategoryId;

export type BuyCategory = {
  id: BuyCategoryId;
  /** Customer-facing label, exactly as requested in the BUY brief. */
  label: string;
  singular: string;
  blurb: string;
  image: string;
  /** Existing listing page for this category (never a new duplicate route). */
  to: string;
};

export const BUY_CATEGORY_LIST: BuyCategory[] = [
  {
    id: "cars",
    label: "Cars",
    singular: "Car",
    blurb: "Sedans, SUVs, Hatchbacks & more",
    image: carCategoryImage,
    to: "/cars",
  },
  {
    id: "bikes",
    label: "Bikes",
    singular: "Bike",
    blurb: "Sports, Commuters, Scooters & more",
    image: bikeCategoryImage,
    to: "/buy/bikes",
  },
  {
    id: "three-wheelers",
    label: "3-Wheelers",
    singular: "3-Wheeler",
    blurb: "Passenger & Cargo",
    image: threeWheelerCategoryImage,
    to: "/buy/three-wheelers",
  },
  {
    id: "scv",
    label: "SCV / Mini Trucks",
    singular: "Small Commercial Vehicle",
    blurb: "Ace, Intra, Dost & more",
    image: scvCategoryImage,
    to: "/buy/scv",
  },
  {
    id: "trucks",
    label: "Trucks",
    singular: "Truck",
    blurb: "Heavy & Medium Duty",
    image: truckCategoryImage,
    to: "/buy/trucks",
  },
  {
    id: "buses",
    label: "Buses",
    singular: "Bus",
    blurb: "Mini, Mid, Luxury & more",
    image: busCategoryImage,
    to: "/buy/buses",
  },
  {
    id: "tractors",
    label: "Tractors",
    singular: "Tractor",
    blurb: "Farm & Utility",
    image: tractorCategoryImage,
    to: "/buy/tractors",
  },
  {
    id: "taxi",
    label: "Taxi / Commercial Cars",
    singular: "Taxi",
    blurb: "Commercial & Fleet Vehicles",
    image: taxiCategoryImage,
    to: "/buy/taxi",
  },
];

export const getBuyCategory = (id: string | undefined | null) =>
  BUY_CATEGORY_LIST.find((c) => c.id === id);

export const BUY_YEAR_MIN = 1992;
export const BUY_YEAR_MAX = 2026;

export type BuyListing = {
  id: string;
  categoryId: BuyCategoryId;
  categoryLabel: string;
  brand: string;
  model: string;
  variant: string | null;
  /** Manufacturing year. */
  year: number;
  /** Only present when the record actually carries it. */
  registrationYear: number | null;
  /** ₹ lakh — the project's existing unit for vehicle prices. */
  priceLakh: number;
  /** null when the category/record does not track kilometres. */
  kilometres: number | null;
  fuel: string;
  transmission: string | null;
  bodyType: string | null;
  city: string;
  /** Locality / colony — null when the seller has not shared it. */
  locality: string | null;
  ownership: string | null;
  images: string[];
  /** true only for a genuinely completed Motor Wallah verification. */
  verified: boolean;
  status: "Available" | "Reserved" | "Sold";
  demo: boolean;
  description: string | null;
  /** Honest caption for the photos that are actually attached. */
  photoNote: string;
  /** Accessible description of the photo that is actually attached. */
  photoAlt: string;
};

const CATEGORY_IMAGES: Record<NonCarCategoryId, string> = {
  bikes: bikeCategoryImage,
  "three-wheelers": threeWheelerCategoryImage,
  scv: scvCategoryImage,
  trucks: truckCategoryImage,
  buses: busCategoryImage,
  tractors: tractorCategoryImage,
  taxi: taxiCategoryImage,
};

const CAR_LISTINGS: BuyListing[] = [
  ...VEHICLES.map((v) => ({
    id: v.id,
    categoryId: "cars" as const,
    categoryLabel: "Cars",
    brand: v.make,
    model: v.model,
    variant: v.variant,
    year: v.year,
    registrationYear: v.registrationYear,
    priceLakh: v.price,
    kilometres: v.kilometres,
    fuel: v.fuel,
    transmission: v.transmission,
    bodyType: v.bodyType,
    city: v.location,
    locality: null,
    ownership: v.ownership,
    images: v.images,
    // A demo record is never verified — a real inspection must exist first.
    verified: v.certified === true && v.inspection?.verified === true,
    status: v.status,
    demo: v.demo,
    description: v.description,
    photoNote: "Neutral body-type placeholder photo. Real vehicle photos are shared by the team.",
    photoAlt: `${v.bodyType} demo placeholder photo`,
  })),
  // Seeded test-data cars (Harrier, Tiago, Punch, Sierra, Swift, Zen, Esteem,
  // Santro …) so every required model has a listing to browse.
  ...EXTRA_DEMO_CARS.map((v) => ({
    id: v.id,
    categoryId: "cars" as const,
    categoryLabel: "Cars",
    brand: v.make,
    model: v.model,
    variant: v.variant,
    year: v.year,
    registrationYear: null,
    priceLakh: v.priceLakh,
    kilometres: v.kilometres,
    fuel: v.fuel,
    transmission: v.transmission,
    bodyType: v.bodyType,
    city: v.location,
    locality: null,
    ownership: v.ownership,
    images: [placeholderFor(v.bodyType)],
    verified: false,
    status: "Available" as const,
    demo: true,
    description: null,
    photoNote: "Neutral body-type placeholder photo. Real vehicle photos are shared by the team.",
    photoAlt: `${v.bodyType} demo placeholder photo`,
  })),
];

const NON_CAR_LISTINGS: BuyListing[] = CATEGORY_LISTINGS.map((l) => {
  const category = CATEGORIES.find((c) => c.id === l.category)!;
  return {
    id: l.id,
    categoryId: l.category,
    categoryLabel: category.title,
    brand: l.brand,
    model: l.model,
    variant: null,
    year: l.year,
    registrationYear: null,
    priceLakh: l.price,
    kilometres: l.kilometres,
    fuel: l.fuel,
    transmission: null,
    bodyType: category.singular,
    city: l.location,
    locality: null,
    ownership: l.ownership,
    images: [CATEGORY_IMAGES[l.category]],
    verified: false,
    status: "Available",
    demo: true,
    description: null,
    photoNote: "Illustrative category photograph. Real vehicle photos are shared by the team.",
    photoAlt: `Illustrative ${category.title} category photograph`,
  };
});

const EXTRA_NON_CAR_LISTINGS: BuyListing[] = EXTRA_DEMO_LISTINGS.flatMap((l) => {
  const category = CATEGORIES.find((c) => c.id === l.categoryId);
  if (!category) return [];
  return [
    {
      id: l.id,
      categoryId: category.id,
      categoryLabel: category.title,
      brand: l.brand,
      model: l.model,
      variant: null,
      year: l.year,
      registrationYear: null,
      priceLakh: l.priceLakh,
      kilometres: l.kilometres,
      fuel: l.fuel,
      transmission: l.transmission,
      bodyType: category.singular,
      city: l.city,
      locality: null,
      ownership: l.ownership,
      images: [CATEGORY_IMAGES[category.id]],
      verified: false,
      status: "Available" as const,
      demo: true,
      description: null,
      photoNote: "Illustrative category photograph. Real vehicle photos are shared by the team.",
      photoAlt: `Illustrative ${category.title} category photograph`,
    },
  ];
});

export const BUY_LISTINGS: BuyListing[] = [
  ...CAR_LISTINGS,
  ...NON_CAR_LISTINGS,
  ...EXTRA_NON_CAR_LISTINGS,
];

export const listingsInCategory = (categoryId: BuyCategoryId) =>
  BUY_LISTINGS.filter((l) => l.categoryId === categoryId);

export const getBuyListing = (id: string) => BUY_LISTINGS.find((l) => l.id === id);

export const listingCount = (categoryId: BuyCategoryId) => listingsInCategory(categoryId).length;

/** Brands that actually have at least one listing in the selected category. */
export const brandsInCategory = (categoryId: BuyCategoryId) => {
  const counts = new Map<string, number>();
  for (const l of listingsInCategory(categoryId)) {
    counts.set(l.brand, (counts.get(l.brand) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([brand, count]) => ({ brand, count }));
};

export const modelsInCategory = (categoryId: BuyCategoryId, brand?: string) => {
  const list = listingsInCategory(categoryId).filter((l) => !brand || l.brand === brand);
  return Array.from(new Set(list.map((l) => l.model))).sort((a, b) => a.localeCompare(b));
};

/** Every brand the category's own catalogue knows (may include zero-stock brands). */
const catalogBrandsIn = (categoryId: BuyCategoryId): string[] => {
  if (categoryId === "cars") return BRAND_NAMES;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category ? Object.keys(category.catalog) : [];
};

/**
 * Brand tiles for the sidebar logo grid: brands with live listings first,
 * then the catalogue's remaining brands — for cars only when real logo
 * artwork exists, so the grid stays a wall of authentic logos rather than
 * dozens of typographic fallbacks. Zero-stock brands stay honest: the tile
 * title shows their count and the empty state explains it.
 */
export const brandTilesFor = (categoryId: BuyCategoryId): { brand: string; count: number }[] => {
  const stocked = brandsInCategory(categoryId);
  const have = new Set(stocked.map((b) => b.brand));
  const extra = catalogBrandsIn(categoryId)
    .filter((brand) => !have.has(brand))
    .filter((brand) => (categoryId === "cars" ? hasBrandLogo(brand) : true))
    .sort((a, b) => a.localeCompare(b))
    .map((brand) => ({ brand, count: 0 }));
  return [...stocked, ...extra];
};

/**
 * Fuel types supported by the selected model, then brand, then category —
 * always derived from real records, never a generic list.
 */
const FUEL_ORDER = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric", "LPG"];

export const fuelOptionsFor = (
  categoryId: BuyCategoryId,
  brand?: string,
  model?: string,
): string[] => {
  const inCategory = listingsInCategory(categoryId);
  const exact = model ? inCategory.filter((l) => l.model === model) : [];
  const byBrand = brand ? inCategory.filter((l) => l.brand === brand) : [];
  const scope = exact.length ? exact : byBrand.length ? byBrand : inCategory;
  const present = new Set(scope.map((l) => l.fuel));
  return FUEL_ORDER.filter((f) => present.has(f));
};

export const citiesInCategory = (categoryId: BuyCategoryId) =>
  Array.from(new Set(listingsInCategory(categoryId).map((l) => l.city))).sort((a, b) =>
    a.localeCompare(b),
  );

/** Price bounds (₹, not lakh) for the budget slider of a category. */
export const priceBounds = (categoryId: BuyCategoryId) => {
  const prices = listingsInCategory(categoryId).map((l) => l.priceLakh * 100000);
  if (!prices.length) return { min: 0, max: 1000000, step: 25000 };
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const span = rawMax - rawMin;
  const step = span > 5000000 ? 50000 : span > 1500000 ? 25000 : span > 400000 ? 10000 : 5000;
  return {
    min: Math.max(0, Math.floor(rawMin / step) * step),
    max: Math.ceil(rawMax / step) * step,
    step,
  };
};

/** ₹12,50,000 — Indian grouping, always in rupees as the BUY brief asks. */
export const rupees = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** ₹7.40 Lakh — the project's existing price format. */
export const lakhLabel = (lakh: number) => `₹${lakh.toFixed(2)} Lakh`;

export const fuelLabel = (fuel: string) => (fuel === "Electric" ? "EV" : fuel);

export const buyListingName = (l: BuyListing) =>
  [l.year, l.brand, l.model, l.variant].filter(Boolean).join(" ");

export const buyListingHighlights = (l: BuyListing) =>
  [
    String(l.year),
    fuelLabel(l.fuel),
    l.transmission,
    l.kilometres !== null ? `${l.kilometres.toLocaleString("en-IN")} km` : null,
    l.ownership,
  ].filter((v): v is string => Boolean(v));

/**
 * Full model catalogue for a brand, including DISCONTINUED models that have
 * no live listing right now (e.g. Maruti Zen / Esteem, Bajaj Discover).
 *
 * Cars read the project's central vehicle catalogue; other categories read
 * their own per-category Brand -> Model catalogue. Selecting a discontinued
 * model legitimately yields zero results, and the empty state says so.
 */
export const catalogModelsFor = (categoryId: BuyCategoryId, brand?: string) => {
  if (categoryId === "cars") {
    const list = modelsForBrand(brand || undefined);
    return brand ? list : list.sort((a, b) => a.localeCompare(b));
  }
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];

  if (brand) {
    const entries = category.catalog[brand] ?? [];
    const fromCatalog = entries.map(([name]) => name);
    const fromListings = listingsInCategory(categoryId)
      .filter((l) => l.brand === brand)
      .map((l) => l.model);
    return Array.from(new Set([...fromCatalog, ...fromListings])).sort((a, b) =>
      a.localeCompare(b),
    );
  }

  // No brand selected — offer every model the category's catalogue knows,
  // so discontinued models stay reachable before a brand is picked too.
  const fromCatalog = Object.values(category.catalog).flatMap((entries) =>
    entries.map(([name]) => name),
  );
  const fromListings = listingsInCategory(categoryId).map((l) => l.model);
  return Array.from(new Set([...fromCatalog, ...fromListings])).sort((a, b) => a.localeCompare(b));
};

/**
 * Transmission options actually present in the scoped records. Categories
 * whose demo records do not track transmission return an empty list, so the
 * UI can disable the control instead of offering choices that do nothing.
 */
const TRANSMISSION_ORDER = ["Manual", "Automatic"];

export const transmissionOptionsFor = (
  categoryId: BuyCategoryId,
  brand?: string,
  model?: string,
): string[] => {
  const inCategory = listingsInCategory(categoryId);
  const exact = model ? inCategory.filter((l) => l.model === model) : [];
  const byBrand = brand ? inCategory.filter((l) => l.brand === brand) : [];
  const scope = exact.length ? exact : byBrand.length ? byBrand : inCategory;
  const present = new Set(scope.map((l) => l.transmission).filter(Boolean));
  return TRANSMISSION_ORDER.filter((t) => present.has(t));
};

/** Free-text search across brand, model, variant, city and id. */
export const matchesSearch = (listing: BuyListing, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [listing.brand, listing.model, listing.variant ?? "", listing.city, listing.id]
    .join(" ")
    .toLowerCase()
    .includes(q);
};
