import { useState } from "react";
import { brandsForYear, modelsForBrand } from "@/lib/vehicle-catalog";
import { SearchableSelect } from "@/components/site/SearchableSelect";
import { FUELS, KM_RANGES, LOCATIONS, PRICE_RANGES, TRANSMISSIONS, YEARS } from "@/lib/cars-data";

/** Shared "no selection" value — identical to the Buy Cars filter system. */
export const ANY = "any";

export type VehicleSelection = {
  brand: string;
  model: string;
  variant: string;
  year: string;
  price: string;
  km: string;
  fuel: string;
  transmission: string;
  location: string;
};

export const EMPTY_SELECTION: VehicleSelection = {
  brand: ANY,
  model: ANY,
  variant: "",
  year: ANY,
  price: ANY,
  km: ANY,
  fuel: ANY,
  transmission: ANY,
  location: ANY,
};

/** Same field markup/typography as the Buy Cars filter panel. */
export function SelectField({
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

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block min-w-0 border border-border bg-background px-3 py-2">
      <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        maxLength={40}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
    </label>
  );
}

/** Brand -> Model -> Year dependency logic, shared by Buy / Sell / Exchange. */
export function useVehicleSelection() {
  const [selection, setSelection] = useState<VehicleSelection>(EMPTY_SELECTION);

  const set = (key: keyof VehicleSelection) => (v: string) =>
    setSelection((s) => ({ ...s, [key]: v }));

  const setBrand = (v: string) => setSelection((s) => ({ ...s, brand: v, model: ANY }));

  const setYear = (v: string) =>
    setSelection((s) => {
      const y = v === ANY ? undefined : v;
      const brandOk = s.brand === ANY || brandsForYear(y).includes(s.brand);
      const brand = brandOk ? s.brand : ANY;
      const modelOk =
        s.model === ANY || modelsForBrand(brand === ANY ? undefined : brand, y).includes(s.model);
      return { ...s, year: v, brand, model: modelOk ? s.model : ANY };
    });

  const reset = () => setSelection(EMPTY_SELECTION);

  return { selection, set, setBrand, setYear, reset };
}

export function VehicleSelectorFields({
  selection,
  set,
  setBrand,
  setYear,
  priceLabel,
  showPrice = true,
  showKm = true,
}: {
  selection: VehicleSelection;
  set: (key: keyof VehicleSelection) => (v: string) => void;
  setBrand: (v: string) => void;
  setYear: (v: string) => void;
  /** e.g. "Expected Price" for Sell, "Budget" for Exchange. */
  priceLabel: string;
  showPrice?: boolean;
  showKm?: boolean;
}) {
  const year = selection.year === ANY ? undefined : selection.year;
  const brandOptions = brandsForYear(year);
  const modelOptions = modelsForBrand(selection.brand === ANY ? undefined : selection.brand, year);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <SelectField label="Brand" value={selection.brand} options={brandOptions} onChange={setBrand} />
      <SearchableSelect
        label="Model"
        placeholder="All Model"
        value={selection.model === ANY ? "" : selection.model}
        options={modelOptions}
        onChange={(v) => set("model")(v || ANY)}
      />
      <TextField
        label="Variant"
        value={selection.variant}
        placeholder="e.g. VXI, SX, ZX (optional)"
        onChange={set("variant")}
      />
      <SelectField label="Year" value={selection.year} options={YEARS} onChange={setYear} />
      {showPrice && (
        <SelectField
          label={priceLabel}
          value={selection.price}
          options={PRICE_RANGES.map((p) => p.label)}
          onChange={set("price")}
        />
      )}
      {showKm && (
        <SelectField
          label="Kilometres"
          value={selection.km}
          options={KM_RANGES.map((k) => k.label)}
          onChange={set("km")}
        />
      )}
      <SelectField label="Fuel Type" value={selection.fuel} options={FUELS} onChange={set("fuel")} />
      <SelectField
        label="Transmission"
        value={selection.transmission}
        options={TRANSMISSIONS}
        onChange={set("transmission")}
      />
      <SelectField label="Location" value={selection.location} options={LOCATIONS} onChange={set("location")} />
    </div>
  );
}


export const selectionToFields = (s: VehicleSelection): Record<string, string> => {
  const out: Record<string, string> = {};
  const push = (k: string, v: string) => {
    if (v && v !== ANY) out[k] = v;
  };
  push("brand", s.brand);
  push("model", s.model);
  push("variant", s.variant.trim());
  push("year", s.year);
  push("price", s.price);
  push("kilometres", s.km);
  push("fuel", s.fuel);
  push("transmission", s.transmission);
  push("location", s.location);
  return out;
};
