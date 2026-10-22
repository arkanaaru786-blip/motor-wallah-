import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fuel, Gauge, MapPin, MessageCircle, Phone, Search, X } from "lucide-react";
import { SearchableSelect } from "@/components/site/SearchableSelect";
import { YEAR_OPTIONS } from "@/lib/vehicle-catalog";
import {
  CATEGORIES,
  categoryBrands,
  categoryModels,
  getCategory,
  listingsFor,
  type CategoryId,
} from "@/lib/vehicle-categories";
import { PHONE_HREF, whatsappLink } from "@/lib/site";
import { submitLead } from "@/lib/leads";

const ANY = "";

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

export function CategoryListingPage({ categoryId }: { categoryId: CategoryId }) {
  const cat = getCategory(categoryId);
  const all = listingsFor(categoryId);
  const [brand, setBrand] = useState(ANY);
  const [model, setModel] = useState(ANY);
  const [year, setYear] = useState(ANY);
  const [fuel, setFuel] = useState(ANY);
  const [location, setLocation] = useState(ANY);
  const [query, setQuery] = useState("");

  const brands = categoryBrands(cat, year || undefined);
  const models = categoryModels(cat, brand || undefined, year || undefined);
  const locations = Array.from(new Set(all.map((l) => l.location)));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (l) =>
        (!brand || l.brand === brand) &&
        (!model || l.model === model) &&
        (!year || String(l.year) === year) &&
        (!fuel || l.fuel === fuel) &&
        (!location || l.location === location) &&
        (!q || `${l.brand} ${l.model} ${l.fuel} ${l.location}`.toLowerCase().includes(q)),
    );
  }, [all, brand, model, year, fuel, location, query]);

  const clear = () => {
    setBrand(ANY);
    setModel(ANY);
    setYear(ANY);
    setFuel(ANY);
    setLocation(ANY);
    setQuery("");
  };

  return (
    <div className="pb-24 md:pb-0">
      <section className="bg-ink py-12 text-ink-foreground">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
          <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl lg:text-5xl">
            Buy Pre-Owned <span className="text-primary">{cat.title}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-foreground/75 sm:text-base">{cat.blurb}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/cars" className="border border-ink-foreground/30 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide hover:border-primary hover:text-primary">
              Cars
            </Link>
            {CATEGORIES.map((c) => (
              <a
                key={c.id}
                href={c.to}
                className={`border px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide ${
                  c.id === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-ink-foreground/30 hover:border-primary hover:text-primary"
                }`}
              >
                {c.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-8">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 lg:grid-cols-[300px_1fr] lg:px-8">
          <aside className="self-start border border-border bg-card p-5 shadow-panel">
            <p className="mb-4 font-display text-lg uppercase">Filters</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Field
                label="Brand"
                value={brand}
                options={brands}
                onChange={(v) => {
                  setBrand(v);
                  setModel(ANY);
                }}
              />
              <SearchableSelect label="Model" placeholder="All Model" value={model} options={models} onChange={setModel} />
              <Field
                label="Year"
                value={year}
                options={YEAR_OPTIONS}
                onChange={(v) => {
                  setYear(v);
                  if (brand && !categoryBrands(cat, v || undefined).includes(brand)) {
                    setBrand(ANY);
                    setModel(ANY);
                  } else if (model && !categoryModels(cat, brand || undefined, v || undefined).includes(model)) {
                    setModel(ANY);
                  }
                }}
              />
              <Field label="Fuel Type" value={fuel} options={cat.fuels} onChange={setFuel} />
              <Field label="Location" value={location} options={locations} onChange={setLocation} />
              <button
                type="button"
                onClick={clear}
                className="border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
              >
                Clear All Filters
              </button>
            </div>
          </aside>

          <div className="min-w-0">
            <label className="flex items-center gap-2 border border-border bg-card px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={60}
                placeholder={`Search ${cat.title.toLowerCase()} by brand or model`}
                aria-label="Search"
                className="w-full bg-transparent text-sm outline-none"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl uppercase">
                {results.length} {cat.title} Found
              </p>
              <p className="text-xs text-muted-foreground">Demo listings — not confirmed Motor Wallah inventory.</p>
            </div>

            {results.length === 0 ? (
              <div className="mt-8 border border-border bg-card p-10 text-center">
                <p className="font-display text-2xl uppercase">No {cat.title} Found</p>
                <p className="mt-2 text-sm text-muted-foreground">Try changing your filters or search.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((l) => {
                  const name = `${l.year} ${l.brand} ${l.model}`;
                  return (
                    <article key={l.id} className="flex flex-col border border-border bg-card p-5 shadow-panel">
                      <span className="self-start bg-secondary px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide">
                        Demo Listing · {cat.singular}
                      </span>
                      <h2 className="mt-3 font-display text-lg uppercase leading-tight">{name}</h2>
                      <p className="mt-1 font-display text-2xl text-primary">₹{l.price.toFixed(2)} Lakh</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-primary" />{l.kilometres.toLocaleString("en-IN")} km</span>
                        <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5 text-primary" />{l.fuel}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{l.location}</span>
                        <span>{l.ownership}</span>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <a
                          href={whatsappLink(`Hi Motor Wallah, I'm interested in the ${name} (${cat.singular}) listed in ${l.location}.`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => void submitLead({ type: "whatsapp_click", source: `buy-${cat.id}`, vehicleId: l.id, vehicleName: name, location: l.location })}
                          className="inline-flex items-center justify-center gap-1.5 bg-primary px-3 py-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-primary-foreground"
                        >
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                        <a
                          href={PHONE_HREF}
                          onClick={() => void submitLead({ type: "call_click", source: `buy-${cat.id}`, vehicleId: l.id, vehicleName: name })}
                          className="inline-flex items-center justify-center gap-1.5 border border-border px-3 py-2.5 text-[0.7rem] font-bold uppercase tracking-wide hover:border-primary hover:text-primary"
                        >
                          <Phone className="h-4 w-4" /> Call
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
