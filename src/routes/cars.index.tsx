import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { brandsForYear, isValidBrandModel, modelsForBrand } from "@/lib/vehicle-catalog";
import { SearchableSelect } from "@/components/site/SearchableSelect";
import {
  AVAILABILITY,
  BODY_TYPES,
  BRANDS,
  FUELS,
  KM_RANGES,
  LOCATIONS,
  OWNERSHIPS,
  PRICE_RANGES,
  TRANSMISSIONS,
  VEHICLES,
  YEARS,
  vehicleName,
  type Vehicle,
} from "@/lib/cars-data";

import { VehicleCard } from "@/components/site/VehicleCard";

const TITLE = "Certified Pre-Owned Cars in Indore | Motor Wallah";
const DESCRIPTION =
  "Find quality-checked pre-owned cars with transparent pricing and complete ownership support across Madhya Pradesh.";

export type CarsSearch = {
  brand?: string | undefined;
  model?: string | undefined;
  year?: string | undefined;
  price?: string | undefined;
  fuel?: string | undefined;
  transmission?: string | undefined;
  location?: string | undefined;
};


const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export const Route = createFileRoute("/cars/")({
  validateSearch: (search: Record<string, unknown>): CarsSearch => ({
    brand: str(search["brand"]),
    model: str(search["model"]),
    year: str(search["year"]),
    price: str(search["price"]),
    fuel: str(search["fuel"]),
    transmission: str(search["transmission"]),
    location: str(search["location"]),
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
  component: Page,
});


const ANY = "any";

type Filters = {
  brand: string;
  model: string;
  price: string;
  year: string;
  km: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  location: string;
  ownership: string;
  availability: string;
};

const EMPTY: Filters = {
  brand: ANY,
  model: ANY,
  price: ANY,
  year: ANY,
  km: ANY,
  fuel: ANY,
  transmission: ANY,
  bodyType: ANY,
  location: ANY,
  ownership: ANY,
  availability: ANY,
};

const LABELS: Record<keyof Filters, string> = {
  brand: "Brand",
  model: "Model",
  price: "Price",
  year: "Year",
  km: "Kilometres",
  fuel: "Fuel Type",
  transmission: "Transmission",
  bodyType: "Body Type",
  location: "Location",
  ownership: "Ownership",
  availability: "Availability",
};

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "km", label: "Lowest KM" },
  { value: "recent", label: "Recently Added" },
];

function applyFilters(list: Vehicle[], f: Filters, q: string) {
  const query = q.trim().toLowerCase();
  return list.filter((v) => {
    if (f.brand !== ANY && v.make !== f.brand) return false;
    if (f.model !== ANY && v.model !== f.model) return false;
    if (f.fuel !== ANY && v.fuel !== f.fuel) return false;
    if (f.transmission !== ANY && v.transmission !== f.transmission) return false;
    if (f.bodyType !== ANY && v.bodyType !== f.bodyType) return false;
    if (f.year !== ANY && String(v.year) !== f.year) return false;
    if (f.location !== ANY && v.location !== f.location) return false;
    if (f.ownership !== ANY && v.ownership !== f.ownership) return false;
    if (f.availability !== ANY && v.status !== f.availability) return false;
    if (f.price !== ANY) {
      const r = PRICE_RANGES.find((x) => x.label === f.price);
      if (r && (v.price < r.min || v.price >= r.max)) return false;
    }
    if (f.km !== ANY) {
      const r = KM_RANGES.find((x) => x.label === f.km);
      if (r && (v.kilometres < r.min || v.kilometres >= r.max)) return false;
    }
    if (query) {
      const haystack = `${vehicleName(v)} ${v.bodyType} ${v.fuel} ${v.transmission} ${v.location}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function sortVehicles(list: Vehicle[], sort: string) {
  const out = [...list];
  if (sort === "price-asc") out.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") out.sort((a, b) => b.price - a.price);
  if (sort === "newest") out.sort((a, b) => b.year - a.year);
  if (sort === "km") out.sort((a, b) => a.kilometres - b.kilometres);
  if (sort === "recent") out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

function Field({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0 border border-border bg-background px-3 py-2">
      <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
      >
        <option value={ANY}>All {label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Page() {
  const search = Route.useSearch();
  const [filters, setFilters] = useState<Filters>(() => {
    const brand = search.brand && BRANDS.includes(search.brand) ? search.brand : ANY;
    const model =
      search.model && (brand === ANY ? true : isValidBrandModel(brand, search.model, search.year))
        ? search.model
        : ANY;
    return {
      ...EMPTY,
      brand,
      model,
      year: search.year ?? ANY,
      price: search.price ?? ANY,
      fuel: search.fuel ?? ANY,
      transmission: search.transmission ?? ANY,
      location: search.location ?? ANY,
    };
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const results = useMemo(
    () => sortVehicles(applyFilters(VEHICLES, filters, query), sort),
    [filters, query, sort],
  );

  const set = (key: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [key]: v }));
  const clearAll = () => {
    setFilters(EMPTY);
    setQuery("");
  };

  const activeChips = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k] !== ANY);

  // Brand + model options come from the central catalogue and respect the year.
  const year = filters.year === ANY ? undefined : filters.year;
  const brandOptions = brandsForYear(year);
  const modelOptions = modelsForBrand(filters.brand === ANY ? undefined : filters.brand, year);

  const setBrand = (v: string) =>
    // Changing brand always resets model so an invalid pair can never remain.
    setFilters((f) => ({ ...f, brand: v, model: ANY }));

  const setYear = (v: string) =>
    setFilters((f) => {
      const y = v === ANY ? undefined : v;
      const brandOk = f.brand === ANY || brandsForYear(y).includes(f.brand);
      const brand = brandOk ? f.brand : ANY;
      const modelOk =
        f.model === ANY ||
        modelsForBrand(brand === ANY ? undefined : brand, y).includes(f.model);
      return { ...f, year: v, brand, model: modelOk ? f.model : ANY };
    });

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <Field label="Brand" value={filters.brand} options={brandOptions} onChange={setBrand} />
      <SearchableSelect
        label="Model"
        placeholder="All Model"
        value={filters.model === ANY ? "" : filters.model}
        options={modelOptions}
        onChange={(v) => set("model")(v || ANY)}
      />


      <Field label="Price" value={filters.price} options={PRICE_RANGES.map((p) => p.label)} onChange={set("price")} />
      <Field label="Year" value={filters.year} options={YEARS} onChange={setYear} />
      <Field label="Kilometres" value={filters.km} options={KM_RANGES.map((k) => k.label)} onChange={set("km")} />
      <Field label="Fuel Type" value={filters.fuel} options={FUELS} onChange={set("fuel")} />
      <Field label="Transmission" value={filters.transmission} options={TRANSMISSIONS} onChange={set("transmission")} />
      <Field label="Body Type" value={filters.bodyType} options={BODY_TYPES} onChange={set("bodyType")} />
      <Field label="Location" value={filters.location} options={LOCATIONS} onChange={set("location")} />
      <Field label="Ownership" value={filters.ownership} options={OWNERSHIPS} onChange={set("ownership")} />
      <Field label="Availability" value={filters.availability} options={AVAILABILITY} onChange={set("availability")} />
      <button
        type="button"
        onClick={clearAll}
        className="border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
      >
        Clear All Filters
      </button>
    </div>
  );

  return (
    <div className="pb-24 md:pb-0">
      <section className="bg-ink py-12 text-ink-foreground">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl lg:text-5xl">
            Certified <span className="text-primary">Pre-Owned Cars</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-foreground/75 sm:text-base">
            Find quality-checked pre-owned cars with transparent pricing and complete ownership support.
          </p>
        </div>
      </section>

      <section className="bg-background py-8">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 lg:grid-cols-[300px_1fr] lg:px-8">
          {/* Desktop filters */}
          <aside className="hidden self-start border border-border bg-card p-5 shadow-panel lg:block">
            <p className="mb-4 font-display text-lg uppercase">Filters</p>
            {fields}
          </aside>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-center gap-2 border border-border bg-card px-3 py-3">
                <Search className="h-4 w-4 shrink-0 text-primary" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={60}
                  placeholder="Search by brand, model or keyword"
                  aria-label="Search by brand, model or keyword"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2 border border-border bg-card px-3 py-3">
                <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex items-center justify-center gap-2 border border-border bg-card px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
              </button>
            </div>

            {activeChips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {activeChips.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set(k)(ANY)}
                    className="flex items-center gap-1.5 border border-border bg-secondary/60 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide"
                  >
                    {LABELS[k]}: {filters[k]} <X className="h-3 w-3 text-primary" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-primary"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl uppercase">
                {results.length} {results.length === 1 ? "Car" : "Cars"} Found
              </p>
              <p className="text-xs text-muted-foreground">
                Demo listings — not confirmed Motor Wallah inventory.
              </p>
            </div>

            {results.length === 0 ? (
              <div className="mt-8 border border-border bg-card p-10 text-center">
                <p className="font-display text-2xl uppercase">No Cars Found</p>
                <p className="mt-2 text-sm text-muted-foreground">Try changing your filters or search.</p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-6 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink/70" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto border-t border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg uppercase">Filters</span>
              <button type="button" aria-label="Close filters" onClick={() => setDrawerOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {fields}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mt-3 w-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
            >
              Show {results.length} Cars
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
