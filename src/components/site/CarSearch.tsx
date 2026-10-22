import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { YEAR_OPTIONS, brandsForYear, modelsForBrand } from "@/lib/vehicle-catalog";
import { SearchableSelect } from "@/components/site/SearchableSelect";

const ALL = "";

const STATIC_FIELDS = [
  { label: "Budget", options: ["Under ₹5 Lakh", "₹5–10 Lakh", "₹10–20 Lakh", "₹20 Lakh+"] },
  { label: "Fuel Type", options: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] },
  { label: "Transmission", options: ["Manual", "Automatic"] },
  { label: "Location", options: ["Indore", "Bhopal", "Ujjain", "Dewas"] },
];

function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0 border border-border px-3 py-2">
      <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
      >
        <option value={ALL}>{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CarSearch() {
  const [brand, setBrand] = useState(ALL);
  const [model, setModel] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [rest, setRest] = useState<Record<string, string>>({});

  const brandOptions = brandsForYear(year || undefined);
  const modelOptions = modelsForBrand(brand || undefined, year || undefined);

  return (
    <section id="search" className="bg-secondary/60 py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="border border-border bg-card p-5 shadow-panel lg:p-7">
          <h2 className="section-title">
            Find Your <span className="text-primary">Dream Car</span>
          </h2>

          <form
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            onSubmit={(e) => e.preventDefault()}
          >
            <SelectField
              label="Brand"
              placeholder="All Brands"
              value={brand}
              options={brandOptions}
              onChange={(v) => {
                setBrand(v);
                setModel(ALL); // brand change always resets the model
              }}
            />
            <SearchableSelect
              label="Model"
              placeholder="All Models"
              value={model}
              options={modelOptions}
              onChange={setModel}
            />
            <SelectField
              label="Year"
              placeholder="All Years"
              value={year}
              options={YEAR_OPTIONS}
              onChange={(v) => {
                setYear(v);
                const y = v || undefined;
                if (brand && !brandsForYear(y).includes(brand)) {
                  setBrand(ALL);
                  setModel(ALL);
                } else if (model && !modelsForBrand(brand || undefined, y).includes(model)) {
                  setModel(ALL);
                }
              }}
            />
            {STATIC_FIELDS.map((f) => (
              <SelectField
                key={f.label}
                label={f.label}
                placeholder={`All ${f.label === "Budget" ? "Budgets" : f.label === "Location" ? "Locations" : f.label}`}
                value={rest[f.label] ?? ALL}
                options={f.options}
                onChange={(v) => setRest((r) => ({ ...r, [f.label]: v }))}
              />
            ))}
          </form>


          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/cars"
              search={{
                brand: brand || undefined,
                model: model || undefined,
                year: year || undefined,
                price: rest["Budget"] || undefined,
                fuel: rest["Fuel Type"] || undefined,
                transmission: rest["Transmission"] || undefined,
                location: rest["Location"] || undefined,
              }}
              className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <Search className="h-4 w-4" /> Search Cars
            </Link>

            <Link
              to="/cars"
              className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
            >
              View All Cars
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
