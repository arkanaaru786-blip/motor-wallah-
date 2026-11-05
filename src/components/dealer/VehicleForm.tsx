import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";

import {
  dealerBrands,
  dealerCategoryLabel,
  dealerFuels,
  dealerModels,
} from "@/lib/dealer-categories";
import {
  VEHICLE_STATUSES,
  type DealerVehicle,
  type VehicleInput,
  type VehicleStatus,
} from "@/lib/dealer-data";
import type { DealerSession } from "@/lib/dealer-session";

/**
 * Add / edit a vehicle.
 *
 * The category is not a field the dealer can change: it comes from the session,
 * the brand list comes from that category's catalogue, and the model list comes
 * from the chosen brand in the same catalogue. A Cars dealer therefore has no
 * way to reach a Bike model from this form.
 */
export function VehicleForm({
  session,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  session: DealerSession;
  initial?: DealerVehicle | null;
  submitLabel: string;
  onSubmit: (input: VehicleInput) => { ok: true } | { ok: false; error: string };
  onCancel?: () => void;
}) {
  const category = session.category;
  const brands = useMemo(() => dealerBrands(category), [category]);
  const fuels = useMemo(() => dealerFuels(category), [category]);

  const [brand, setBrand] = useState(initial?.brand ?? brands[0] ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const models = useMemo(() => (brand ? dealerModels(category, brand) : []), [category, brand]);

  const [year, setYear] = useState(String(initial?.year ?? new Date().getFullYear()));
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [km, setKm] = useState(initial ? String(initial.km) : "0");
  const [fuel, setFuel] = useState(initial?.fuel ?? fuels[0] ?? "Petrol");
  const [status, setStatus] = useState<VehicleStatus>(initial?.status ?? "Pending");
  const [error, setError] = useState<string | null>(null);

  // Keep the model valid whenever the brand (or a freshly loaded catalogue)
  // changes: a stale model must never be submitted.
  useEffect(() => {
    if (!models.includes(model)) setModel(models[0] ?? "");
  }, [models, model]);

  useEffect(() => {
    if (!fuels.includes(fuel)) setFuel(fuels[0] ?? "Petrol");
  }, [fuels, fuel]);

  return (
    <form
      className="mw-dealer-form"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const result = onSubmit({
          brand,
          model,
          year: Number(year),
          price: Number(price),
          km: Number(km),
          fuel,
          status,
        });
        if (!result.ok) setError(result.error);
      }}
      data-testid="dealer-vehicle-form"
    >
      <label className="mw-dealer-field">
        <span>Category</span>
        <input value={dealerCategoryLabel(category)} readOnly data-testid="vehicle-category" />
      </label>

      <label className="mw-dealer-field">
        <span>Brand</span>
        <select
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          data-testid="vehicle-brand"
        >
          {brands.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="mw-dealer-field">
        <span>Model</span>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          data-testid="vehicle-model"
        >
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="mw-dealer-field">
        <span>Year</span>
        <input
          type="number"
          min={1990}
          max={2026}
          value={year}
          onChange={(event) => setYear(event.target.value)}
          required
          data-testid="vehicle-year"
        />
      </label>

      <label className="mw-dealer-field">
        <span>Asking price (₹)</span>
        <input
          type="number"
          min={1000}
          step={1000}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="450000"
          required
          data-testid="vehicle-price"
        />
      </label>

      <label className="mw-dealer-field">
        <span>Kilometres driven</span>
        <input
          type="number"
          min={0}
          step={100}
          value={km}
          onChange={(event) => setKm(event.target.value)}
          required
          data-testid="vehicle-km"
        />
      </label>

      <label className="mw-dealer-field">
        <span>Fuel</span>
        <select
          value={fuel}
          onChange={(event) => setFuel(event.target.value)}
          data-testid="vehicle-fuel"
        >
          {fuels.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="mw-dealer-field">
        <span>Listing status</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as VehicleStatus)}
          data-testid="vehicle-status"
        >
          {VEHICLE_STATUSES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <p className="mw-dealer-field-hint mw-dealer-field">
        <span>
          Only {dealerCategoryLabel(category).toLowerCase()} brands from the Motor Wallah catalogue
          are shown.
        </span>
      </p>

      {error ? (
        <p className="mw-dealer-error" role="alert" style={{ gridColumn: "1 / -1" }}>
          {error}
        </p>
      ) : null}

      <div className="mw-dealer-form-actions">
        <button type="submit" className="mw-dealer-btn is-primary" data-testid="vehicle-save">
          <Save size={15} /> {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="mw-dealer-btn" onClick={onCancel}>
            <X size={15} /> Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
