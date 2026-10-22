import { useState } from "react";
import { ArrowLeft, LayoutGrid, Search, SlidersHorizontal } from "lucide-react";
import { SearchableSelect } from "@/components/site/SearchableSelect";
import { Switch } from "@/components/ui/switch";
import { DualRangeSlider } from "@/components/buy/DualRangeSlider";
import { BrandArt } from "@/components/buy/BrandArt";
import { BUY_YEAR_MAX, BUY_YEAR_MIN, fuelLabel, rupees } from "@/lib/buy-catalog";
import type { BuyServiceCategory } from "@/lib/buy-services";

/**
 * Page 2 of the BUY marketplace — the frosted-glass filter sidebar.
 *
 * Vehicle categories get: search, brand logo grid, brand-scoped model list
 * (including discontinued models), budget slider, 1992–2026 year range,
 * model-appropriate fuel, transmission, location and verified-only.
 * There is deliberately NO owners filter.
 *
 * Service categories swap the vehicle controls for their own primary filter
 * (bank name, provider, service type, part category).
 */

export type BuyFilters = {
  query: string;
  brand: string;
  model: string;
  fuel: string;
  transmission: string;
  city: string;
  price: [number, number];
  yearMin: number;
  yearMax: number;
  verifiedOnly: boolean;
};

export type BuyServiceFilters = {
  query: string;
  option: string;
  city: string;
  price: [number, number];
};

export const YEARS_DESC = Array.from({ length: BUY_YEAR_MAX - BUY_YEAR_MIN + 1 }, (_, i) =>
  String(BUY_YEAR_MAX - i),
);

const ANY = "";

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string | undefined }) {
  return (
    <span className="mw-side-label">
      {children}
      {hint && <small>{hint}</small>}
    </span>
  );
}

function SideShell({
  title,
  countLabel,
  activeCount,
  onBack,
  onClear,
  children,
}: {
  title: string;
  countLabel: string;
  activeCount: number;
  onBack: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="mw-side" id="buy-filters" data-open={open || undefined}>
      <div className="mw-side-inner">
        <button type="button" className="mw-side-back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to categories
        </button>

        <button
          type="button"
          className="mw-side-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="buy-filter-panel"
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters {activeCount > 0 && `· ${activeCount}`}
        </button>

        <div className="mw-side-summary">
          <p className="mw-side-kicker">Selected category</p>
          <p className="mw-side-title">{title}</p>
          <p className="mw-side-count">{countLabel}</p>
        </div>

        <div className="mw-side-panel" id="buy-filter-panel">
          <div className="mw-side-panel-head">
            <span>Filters</span>
            <button
              type="button"
              onClick={onClear}
              disabled={activeCount === 0}
              className="mw-side-clear"
            >
              Clear All
            </button>
          </div>
          <div className="mw-side-sections">{children}</div>
        </div>
      </div>
    </aside>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mw-side-field">
      <FieldLabel>Search</FieldLabel>
      <span className="mw-side-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Search listings"
        />
      </span>
    </div>
  );
}

export function BuyVehicleSidebar({
  categoryLabel,
  countLabel,
  filters,
  brands,
  models,
  fuels,
  transmissions,
  cities,
  bounds,
  activeCount,
  onBack,
  onChange,
  onClear,
}: {
  categoryLabel: string;
  countLabel: string;
  filters: BuyFilters;
  brands: { brand: string; count: number }[];
  models: string[];
  fuels: string[];
  transmissions: string[];
  cities: string[];
  bounds: { min: number; max: number; step: number };
  activeCount: number;
  onBack: () => void;
  onChange: (patch: Partial<BuyFilters>) => void;
  onClear: () => void;
}) {
  const setBrand = (brand: string) => onChange({ brand, model: ANY });
  const setYearMin = (year: number) =>
    onChange({ yearMin: year, yearMax: Math.max(year, filters.yearMax) });
  const setYearMax = (year: number) =>
    onChange({ yearMax: year, yearMin: Math.min(year, filters.yearMin) });

  return (
    <SideShell
      title={categoryLabel}
      countLabel={countLabel}
      activeCount={activeCount}
      onBack={onBack}
      onClear={onClear}
    >
      <SearchField
        value={filters.query}
        onChange={(query) => onChange({ query })}
        placeholder="Brand, model or city"
      />

      <div className="mw-side-field">
        <FieldLabel>Brand</FieldLabel>
        <div className="mw-brand-grid" role="group" aria-label="Brand logos">
          <button
            type="button"
            className="mw-brand-tile mw-brand-tile--all"
            aria-pressed={filters.brand === ANY}
            data-active={filters.brand === ANY || undefined}
            onClick={() => setBrand(ANY)}
          >
            <LayoutGrid size={18} aria-hidden="true" />
            <span>All</span>
          </button>
          {brands.map(({ brand, count }) => (
            <button
              key={brand}
              type="button"
              className="mw-brand-tile"
              aria-pressed={filters.brand === brand}
              aria-label={`${brand} (${count})`}
              title={`${brand} — ${count} listings`}
              data-active={filters.brand === brand || undefined}
              onClick={() => setBrand(brand)}
            >
              <BrandArt brand={brand} className="mw-brand-img" />
            </button>
          ))}
        </div>
      </div>

      <div className="mw-side-field">
        <FieldLabel hint={filters.brand ? undefined : "Pick a brand first"}>Model</FieldLabel>
        <div
          className="mw-side-lock"
          aria-disabled={filters.brand ? undefined : true}
          data-disabled={filters.brand ? undefined : "true"}
        >
          <SearchableSelect
            label="Model"
            placeholder="All models"
            value={filters.model}
            options={filters.brand ? models : []}
            onChange={(model) => onChange({ model })}
          />
        </div>
        {filters.brand ? (
          <p className="mw-side-hint">
            Includes discontinued models — some may have no live listing right now.
          </p>
        ) : (
          <p className="mw-side-hint">Select a brand to enable the model list.</p>
        )}
      </div>

      <div className="mw-side-field">
        <FieldLabel>Budget</FieldLabel>
        <p className="mw-side-budget">
          {rupees(filters.price[0])} – {rupees(filters.price[1])}
        </p>
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

      <div className="mw-side-field">
        <FieldLabel hint={`${BUY_YEAR_MIN} – ${BUY_YEAR_MAX}`}>Manufacturing year</FieldLabel>
        <div className="mw-side-years">
          <select
            aria-label="Year from"
            value={String(filters.yearMin)}
            onChange={(event) => setYearMin(Number(event.target.value))}
            className="mw-side-select"
          >
            {YEARS_DESC.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span aria-hidden="true">–</span>
          <select
            aria-label="Year to"
            value={String(filters.yearMax)}
            onChange={(event) => setYearMax(Number(event.target.value))}
            className="mw-side-select"
          >
            {YEARS_DESC.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mw-side-field">
        <FieldLabel>Fuel type</FieldLabel>
        <div className="mw-chip-row" role="group" aria-label="Fuel type">
          <button
            type="button"
            className="mw-chip"
            aria-pressed={filters.fuel === ANY}
            data-active={filters.fuel === ANY || undefined}
            onClick={() => onChange({ fuel: ANY })}
          >
            All
          </button>
          {fuels.map((fuel) => (
            <button
              key={fuel}
              type="button"
              className="mw-chip"
              aria-pressed={filters.fuel === fuel}
              data-active={filters.fuel === fuel || undefined}
              onClick={() => onChange({ fuel })}
            >
              {fuelLabel(fuel)}
            </button>
          ))}
        </div>
        {fuels.length === 0 && <p className="mw-side-hint">No fuel data for this selection.</p>}
      </div>

      <div className="mw-side-field">
        <FieldLabel>Transmission</FieldLabel>
        <div className="mw-chip-row" role="group" aria-label="Transmission">
          <button
            type="button"
            className="mw-chip"
            disabled={transmissions.length === 0}
            aria-pressed={filters.transmission === ANY}
            data-active={filters.transmission === ANY || undefined}
            onClick={() => onChange({ transmission: ANY })}
          >
            All
          </button>
          {transmissions.map((gearbox) => (
            <button
              key={gearbox}
              type="button"
              className="mw-chip"
              aria-pressed={filters.transmission === gearbox}
              data-active={filters.transmission === gearbox || undefined}
              onClick={() => onChange({ transmission: gearbox })}
            >
              {gearbox}
            </button>
          ))}
        </div>
        {transmissions.length === 0 && (
          <p className="mw-side-hint">
            Transmission is not recorded for these demo listings, so the filter stays off instead of
            offering choices that do nothing.
          </p>
        )}
      </div>

      <div className="mw-side-field">
        <FieldLabel>Location</FieldLabel>
        <SearchableSelect
          label="Location"
          placeholder="All cities"
          value={filters.city}
          options={cities}
          onChange={(city) => onChange({ city })}
        />
      </div>

      <div className="mw-side-field">
        <FieldLabel>Verified listings</FieldLabel>
        <label className="mw-side-switch">
          <Switch
            checked={filters.verifiedOnly}
            onCheckedChange={(checked) => onChange({ verifiedOnly: checked })}
            aria-label="Show verified listings only"
          />
          <span>{filters.verifiedOnly ? "Verified only" : "All listings"}</span>
        </label>
        <p className="mw-side-hint">
          Verified appears only after a completed Motor Wallah inspection — never because a seller
          submitted a listing.
        </p>
      </div>
    </SideShell>
  );
}

export function BuyServiceSidebar({
  service,
  countLabel,
  filters,
  options,
  cities,
  bounds,
  activeCount,
  onBack,
  onChange,
  onClear,
}: {
  service: BuyServiceCategory;
  countLabel: string;
  filters: BuyServiceFilters;
  options: string[];
  cities: string[];
  bounds: { min: number; max: number; step: number };
  activeCount: number;
  onBack: () => void;
  onChange: (patch: Partial<BuyServiceFilters>) => void;
  onClear: () => void;
}) {
  return (
    <SideShell
      title={service.label}
      countLabel={countLabel}
      activeCount={activeCount}
      onBack={onBack}
      onClear={onClear}
    >
      <SearchField
        value={filters.query}
        onChange={(query) => onChange({ query })}
        placeholder={`Search ${service.label.toLowerCase()}`}
      />

      <div className="mw-side-field">
        <FieldLabel>{service.optionLabel}</FieldLabel>
        <SearchableSelect
          label={service.optionLabel}
          placeholder={`All ${service.optionLabel.toLowerCase()}s`}
          value={filters.option}
          options={options}
          onChange={(option) => onChange({ option })}
        />
      </div>

      <div className="mw-side-field">
        <FieldLabel>{service.budgetLabel}</FieldLabel>
        <p className="mw-side-budget">
          {rupees(filters.price[0])} – {rupees(filters.price[1])}
        </p>
        <DualRangeSlider
          label={service.budgetLabel}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          value={filters.price}
          format={rupees}
          onChange={(price) => onChange({ price })}
        />
      </div>

      <div className="mw-side-field">
        <FieldLabel>Location</FieldLabel>
        <SearchableSelect
          label="Location"
          placeholder="All cities"
          value={filters.city}
          options={cities}
          onChange={(city) => onChange({ city })}
        />
      </div>

      <p className="mw-side-note">{service.disclaimer}</p>
    </SideShell>
  );
}
