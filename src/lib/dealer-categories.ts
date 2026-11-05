/**
 * Vehicle categories a dealer can be bound to.
 *
 * A dealer belongs to exactly ONE of these. The id stored on the dealer record
 * (and in `public.staff.category` in Supabase) is the whole access boundary: the
 * dealer portal filters inventory, leads and offers by it, and the Add Vehicle
 * form is pre-set to it. There is deliberately no "All categories" value.
 *
 * Brand and model lists are reused from the public catalogues so a dealer never
 * sees a brand that does not belong to their category.
 */
import { BRAND_NAMES, FUEL_TYPES, modelsForBrand } from "@/lib/vehicle-catalog";
import { CATEGORIES, getCategory, type CategoryId } from "@/lib/vehicle-categories";

export type DealerCategoryId = "cars" | CategoryId;

export type DealerCategoryDef = {
  id: DealerCategoryId;
  /** Plural label, e.g. "Cars", used in headings and KPIs. */
  label: string;
  /** Singular label, e.g. "Car", used in buttons and empty states. */
  singular: string;
  /** Where this category lives on the public site. */
  to: string;
};

export const DEALER_CATEGORIES: DealerCategoryDef[] = [
  { id: "cars", label: "Cars", singular: "Car", to: "/cars" },
  ...CATEGORIES.map((category) => ({
    id: category.id as DealerCategoryId,
    label: category.title,
    singular: category.singular,
    to: category.to,
  })),
];

const BY_ID = new Map(DEALER_CATEGORIES.map((category) => [category.id, category]));

export const isDealerCategory = (value: unknown): value is DealerCategoryId =>
  typeof value === "string" && BY_ID.has(value as DealerCategoryId);

export const getDealerCategory = (id: DealerCategoryId): DealerCategoryDef =>
  BY_ID.get(id) ?? DEALER_CATEGORIES[0]!;

export const dealerCategoryLabel = (id: string): string =>
  isDealerCategory(id) ? getDealerCategory(id).label : id;

export const dealerCategorySingular = (id: string): string =>
  isDealerCategory(id) ? getDealerCategory(id).singular : "Vehicle";

/** Brands that belong to one category only. */
export function dealerBrands(category: DealerCategoryId): string[] {
  if (category === "cars") return [...BRAND_NAMES].sort((a, b) => a.localeCompare(b));
  const definition = CATEGORIES.find((item) => item.id === category);
  if (!definition) return [];
  return Object.keys(definition.catalog).sort((a, b) => a.localeCompare(b));
}

/** Models for a brand inside one category, newest first. */
export function dealerModels(category: DealerCategoryId, brand: string): string[] {
  if (category === "cars") {
    // The car catalogue lists newest models first, so its order is kept.
    return modelsForBrand(brand);
  }
  const definition = CATEGORIES.find((item) => item.id === category);
  const entries = definition?.catalog[brand] ?? [];
  return entries
    .slice()
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))
    .map((entry) => entry[0]);
}

/** Fuel options offered for a category in the Add Vehicle form. */
export function dealerFuels(category: DealerCategoryId): string[] {
  if (category === "cars") return [...FUEL_TYPES];
  return [...getCategory(category as CategoryId).fuels];
}

/** True when the brand/model pair is valid inside the category. */
export function isValidDealerVehicle(
  category: DealerCategoryId,
  brand: string,
  model: string,
): boolean {
  return dealerModels(category, brand).includes(model);
}
