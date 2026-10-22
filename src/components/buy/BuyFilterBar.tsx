import { X } from "lucide-react";
import { SearchableSelect } from "@/components/site/SearchableSelect";
import { Switch } from "@/components/ui/switch";
import { DualRangeSlider } from "@/components/buy/DualRangeSlider";
import { BUY_YEAR_MAX, BUY_YEAR_MIN, fuelLabel, rupees } from "@/lib/buy-catalog";

export type BuyFilters = {
  brand: string;
  model: string;
  fuel: string;
  city: string;
  price: [number, number];
  yearMin: number;
  yearMax: number;
  verifiedOnly: boolean;
};

export const YEARS_DESC = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

const ANY = "";

function YearSelect({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="buy-field">
      <span className="buy-field-label">{label}</span>
      <select
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="buy-field-select"
      >
        {YEARS_DESC.map((year) => (
          <option key={year} value={year}>
            {year}
            {hint && year === String(value) ? ` ${hint}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BuyFilterBar({
  filters,
  brands,
  models,
  fuels,
  cities,
  bounds,
  activeCount,
  onChange,
  onClear,
}: {
  filters: BuyFilters;
  brands: { brand: string; count: number }[];
  models: string[];
  fuels: string[];
  cities: string[];
  bounds: { min: number; max: number; step: number };
  activeCount: number;
  onChange: (patch: Partial<BuyFilters>) => void;
  onClear: () => void;
}) {
  const setBrand = (brand: string) => onChange({ brand, model: ANY });
  const setModel = (model: string) => onChange({ model });

  const setYearMin = (year: number) =>
    onChange({ yearMin: year, yearMax: Math.max(year, filters.yearMax) });
  const setYearMax = (year: number) =>
    onChange({ yearMax: year, yearMin: Math.min(year, filters.yearMin) });

  return (
    <div className="buy-filter-panel" id="buy-filters">
      <div className="buy-filter-head">
        <div className="buy-filter-title">
          <span className="buy-filter-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" strokeLinecap="round" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </span>
          <span>
            Filters
            <small>{activeCount === 0 ? "Nothing applied yet" : `${activeCount} applied`}</small>
          </span>
        </div>
        <button type="button" onClick={onClear} disabled={activeCount === 0} className="buy-clear">
          Clear All
        </button>
      </div>

      <div className="buy-filter-grid">
        <label className="buy-field">
          <span className="buy-field-label">Brand</span>
          <select
            value={filters.brand}
            onChange={(event) => setBrand(event.target.value)}
            className="buy-field-select"
          >
            <option value={ANY}>All brands</option>
            {brands.map(({ brand, count }) => (
              <option key={brand} value={brand}>
                {brand} ({count})
              </option>
            ))}
          </select>
        </label>

        <SearchableSelect
          label="Model"
          placeholder="All models"
          value={filters.model}
          options={models}
          onChange={setModel}
        />

        <div className="buy-filter-budget">
          <div className="buy-filter-budget-head">
            <span className="buy-field-label">Budget / price range</span>
            <span className="buy-filter-budget-value">
              {rupees(filters.price[0])} – {rupees(filters.price[1])}
            </span>
          </div>
          <DualRangeSlider
            label="Budget"
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            value={filters.price}
            format={rupees}
            onChange={(price) => onChange({ price })}
          />
        </div>

        <div className="buy-filter-years">
          <span className="buy-field-label">Manufacturing year</span>
          <div className="buy-filter-years-row">
            <YearSelect label="From" value={filters.yearMin} onChange={setYearMin} />
            <span className="buy-filter-years-dash" aria-hidden="true">
              –
            </span>
            <YearSelect label="To" value={filters.yearMax} onChange={setYearMax} />
          </div>
        </div>

        <SearchableSelect
          label="Location"
          placeholder="All cities"
          value={filters.city}
          options={cities}
          onChange={(city) => onChange({ city })}
        />

        <div className="buy-field buy-field--fuel">
          <span className="buy-field-label">Fuel type</span>
          <div className="buy-fuel-chips" role="group" aria-label="Fuel type">
            <button
              type="button"
              onClick={() => onChange({ fuel: ANY })}
              aria-pressed={filters.fuel === ANY}
              data-active={filters.fuel === ANY || undefined}
              className="buy-fuel-chip"
            >
              All
            </button>
            {fuels.map((fuel) => (
              <button
                key={fuel}
                type="button"
                onClick={() => onChange({ fuel })}
                aria-pressed={filters.fuel === fuel}
                data-active={filters.fuel === fuel || undefined}
                className="buy-fuel-chip"
              >
                {fuelLabel(fuel)}
              </button>
            ))}
          </div>
          {fuels.length === 0 && <p className="buy-field-hint">No fuel options for this model.</p>}
        </div>

        <div className="buy-field buy-field--verified">
          <span className="buy-field-label">Verified listings only</span>
          <div className="buy-verified-row">
            <Switch
              checked={filters.verifiedOnly}
              onCheckedChange={(checked) => onChange({ verifiedOnly: checked })}
              aria-label="Show verified listings only"
            />
            <span>{filters.verifiedOnly ? "Verified only" : "All listings"}</span>
          </div>
          <p className="buy-field-hint">
            A vehicle is marked verified only after a real Motor Wallah inspection is completed.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Compact removable chips summarising the applied filters. */
export function BuyActiveFilters({
  filters,
  bounds,
  brands,
  onChange,
  onClear,
}: {
  filters: BuyFilters;
  bounds: { min: number; max: number };
  brands: { brand: string; count: number }[];
  onChange: (patch: Partial<BuyFilters>) => void;
  onClear: () => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (filters.brand) {
    const exists = brands.some((b) => b.brand === filters.brand);
    chips.push({
      key: "brand",
      label: exists ? filters.brand : `${filters.brand} (no listings)`,
      clear: () => onChange({ brand: ANY, model: ANY }),
    });
  }
  if (filters.model) {
    chips.push({ key: "model", label: filters.model, clear: () => onChange({ model: ANY }) });
  }
  if (filters.fuel) {
    chips.push({
      key: "fuel",
      label: fuelLabel(filters.fuel),
      clear: () => onChange({ fuel: ANY }),
    });
  }
  if (filters.city) {
    chips.push({ key: "city", label: filters.city, clear: () => onChange({ city: ANY }) });
  }
  if (filters.price[0] !== bounds.min || filters.price[1] !== bounds.max) {
    chips.push({
      key: "price",
      label: `${rupees(filters.price[0])} – ${rupees(filters.price[1])}`,
      clear: () => onChange({ price: [bounds.min, bounds.max] }),
    });
  }
  if (filters.yearMin !== BUY_YEAR_MIN || filters.yearMax !== BUY_YEAR_MAX) {
    chips.push({
      key: "year",
      label: `${filters.yearMin} – ${filters.yearMax}`,
      clear: () => onChange({ yearMin: BUY_YEAR_MIN, yearMax: BUY_YEAR_MAX }),
    });
  }
  if (filters.verifiedOnly) {
    chips.push({
      key: "verified",
      label: "Verified only",
      clear: () => onChange({ verifiedOnly: false }),
    });
  }

  if (!chips.length) return null;

  return (
    <div className="buy-active-filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" onClick={chip.clear} className="buy-active-chip">
          {chip.label}
          <X size={12} aria-hidden="true" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button type="button" onClick={onClear} className="buy-active-clear">
        Clear all
      </button>
    </div>
  );
}
