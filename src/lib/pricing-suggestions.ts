/**
 * Phase 3B — dynamic pricing suggestions for the dealer portal (mock model).
 *
 * Compares each listing's views and leads against the dealer's own book and a
 * simple rule set:
 *   • lots of views, almost no leads → the price is scaring buyers away → drop
 *   • healthy leads per view            → demand is there            → raise
 *   • everything else                   → hold and let it gather views
 *
 * Nothing is changed automatically; the dealer still edits the price.
 */
import type { DealerVehicle } from "@/lib/dealer-data";

export type PriceAction = "reduce" | "increase" | "hold";

export type PriceSuggestion = {
  vehicleId: string;
  name: string;
  currentPrice: number;
  suggestedPrice: number;
  action: PriceAction;
  deltaPct: number;
  confidence: number;
  headline: string;
  reason: string;
  views: number;
  leads: number;
  leadRate: number;
};

export type PricingReport = {
  suggestions: PriceSuggestion[];
  dropCount: number;
  raiseCount: number;
  holdCount: number;
  benchmark: { avgViews: number; avgLeadRate: number; sampleSize: number };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function roundPrice(value: number) {
  const step = value >= 200000 ? 5000 : value >= 50000 ? 1000 : 500;
  return Math.max(step, Math.round(value / step) * step);
}

function leadRateOf(vehicle: DealerVehicle) {
  if (vehicle.views <= 0) return 0;
  return Math.round((vehicle.leads / vehicle.views) * 1000) / 10;
}

function suggestFor(vehicle: DealerVehicle, avgViews: number): PriceSuggestion {
  const leadRate = leadRateOf(vehicle);
  const highViews = vehicle.views >= Math.max(40, avgViews * 1.15);
  const stalled = vehicle.leads <= 1 || vehicle.views / Math.max(1, vehicle.leads) >= 35;
  const hot = vehicle.leads >= 3 && leadRate >= 2.5;
  const warming = vehicle.leads >= 2 && vehicle.views >= 30 && leadRate >= 1.8;

  let action: PriceAction = "hold";
  let deltaPct = 0;

  if (highViews && stalled) {
    action = "reduce";
    const pressure = clamp(Math.round(vehicle.views / Math.max(1, vehicle.leads) / 25), 0, 5);
    deltaPct = -(4 + pressure);
  } else if (hot) {
    action = "increase";
    deltaPct = clamp(3 + Math.round((leadRate - 2.5) * 1.5), 3, 7);
  } else if (warming) {
    action = "increase";
    deltaPct = 3;
  }

  const suggestedPrice =
    action === "hold"
      ? vehicle.price
      : roundPrice(vehicle.price * (1 + deltaPct / 100));

  const confidence = clamp(
    Math.round(52 + Math.min(26, vehicle.views / 4) + Math.min(16, vehicle.leads * 3) - (action === "hold" ? 6 : 0)),
    45,
    94,
  );

  let headline = "Hold the current price";
  let reason = `${vehicle.views} views and ${vehicle.leads} leads so far — too early for a confident pricing call. Keep it listed and re-check next week.`;

  if (action === "reduce") {
    headline = "Price drop recommended";
    reason = `${vehicle.views} views but only ${vehicle.leads} lead${vehicle.leads === 1 ? "" : "s"} — buyers are looking but the price is stalling enquiries. A ${Math.abs(deltaPct)}% trim keeps you inside the market band.`;
  } else if (action === "increase") {
    headline = "Raise the asking price";
    reason = `${vehicle.leads} leads from ${vehicle.views} views (${leadRate}% enquiry rate) — demand is outpacing supply. A ${deltaPct}% increase still lands under comparable listings.`;
  }

  return {
    vehicleId: vehicle.id,
    name: vehicle.name,
    currentPrice: vehicle.price,
    suggestedPrice,
    action,
    deltaPct,
    confidence,
    headline,
    reason,
    views: vehicle.views,
    leads: vehicle.leads,
    leadRate,
  };
}

export function pricingReport(vehicles: DealerVehicle[]): PricingReport {
  const listed = vehicles.filter((vehicle) => vehicle.status !== "Sold");
  const sample = listed.length ? listed : vehicles;
  const avgViews = sample.length
    ? Math.round(sample.reduce((total, vehicle) => total + vehicle.views, 0) / sample.length)
    : 0;
  const avgLeadRate = sample.length
    ? Math.round(
        (sample.reduce((total, vehicle) => total + leadRateOf(vehicle), 0) / sample.length) * 10,
      ) / 10
    : 0;

  const suggestions = sample
    .map((vehicle) => suggestFor(vehicle, avgViews))
    .sort((a, b) => {
      const rank = (item: PriceSuggestion) => (item.action === "hold" ? 2 : item.action === "reduce" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return b.confidence - a.confidence;
    });

  return {
    suggestions,
    dropCount: suggestions.filter((item) => item.action === "reduce").length,
    raiseCount: suggestions.filter((item) => item.action === "increase").length,
    holdCount: suggestions.filter((item) => item.action === "hold").length,
    benchmark: { avgViews, avgLeadRate, sampleSize: sample.length },
  };
}

export function actionLabel(action: PriceAction) {
  if (action === "reduce") return "Drop price";
  if (action === "increase") return "Raise price";
  return "Hold price";
}
