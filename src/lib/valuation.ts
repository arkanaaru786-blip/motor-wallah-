/**
 * Preliminary, rules-based market estimate for the Sell Your Car journey.
 *
 * This is deliberately an INDICATIVE estimate: it never claims live market
 * data. When inputs are thin, the range widens and the confidence drops so
 * the customer is told plainly that the number is not a purchase offer.
 */

export type ValuationInput = {
  brand: string;
  model: string;
  variant?: string | undefined;
  year?: string | undefined;
  fuel?: string | undefined;
  transmission?: string | undefined;
  location?: string | undefined;
  currentKm?: string | undefined;
  ownership?: string | undefined;
  condition?: string | undefined;
  accidentHistory?: string | undefined;
  serviceHistory?: string | undefined;
  tyreCondition?: string | undefined;
  insuranceStatus?: string | undefined;
  hasInsuranceDoc?: boolean;
};

export type Valuation = {
  /** Lower bound in rupees. */
  low: number;
  /** Upper bound in rupees. */
  high: number;
  label: string;
  confidence: "Low" | "Moderate" | "Indicative";
  notes: string[];
};

/** Rough new-car price tiers (₹ lakh) used only as a starting reference point. */
const BRAND_TIER: Record<string, number> = {
  Maruti: 7.5,
  "Maruti Suzuki": 7.5,
  Tata: 9,
  Hyundai: 9.5,
  Renault: 8,
  Nissan: 8.5,
  Datsun: 5.5,
  Honda: 10.5,
  Kia: 12,
  MG: 14,
  Toyota: 14,
  Skoda: 15,
  Volkswagen: 14,
  Ford: 10,
  Chevrolet: 6.5,
  Mahindra: 12,
  Jeep: 20,
  Citroen: 11,
  Fiat: 6.5,
  BMW: 45,
  "Mercedes-Benz": 50,
  Audi: 45,
  Volvo: 45,
  "Land Rover": 70,
  Jaguar: 60,
  Lexus: 75,
  Porsche: 120,
  Mini: 40,
  Isuzu: 18,
  Force: 12,
  Ashok: 12,
};

const SEGMENT_BUMP = (model: string) => {
  const m = model.toLowerCase();
  if (/(fortuner|endeavour|gloster|land cruiser|defender)/.test(m)) return 2.4;
  if (/(creta|seltos|harrier|safari|hector|compass|xuv7|scorpio|innova|hycross|alcazar)/.test(m)) return 1.6;
  if (/(nexon|venue|sonet|brezza|magnite|kiger|punch|xuv3)/.test(m)) return 1.15;
  if (/(city|verna|slavia|virtus|ciaz|octavia|camry)/.test(m)) return 1.2;
  if (/(alto|kwid|s-presso|eon|santro|redi-go|celerio)/.test(m)) return 0.7;
  return 1;
};

const KM_FROM_LABEL = (v?: string) => {
  if (!v) return undefined;
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const clampFactor = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function estimateValue(input: ValuationInput): Valuation {
  const notes: string[] = [];
  const tierKey = Object.keys(BRAND_TIER).find(
    (b) => b.toLowerCase() === input.brand.trim().toLowerCase(),
  );
  const baseLakh = (tierKey ? BRAND_TIER[tierKey]! : 9) * SEGMENT_BUMP(input.model ?? "");

  const currentYear = new Date().getFullYear();
  const year = Number(input.year);
  const age = Number.isFinite(year) && year > 1990 ? Math.max(0, currentYear - year) : 8;
  if (!Number.isFinite(year)) notes.push("Manufacturing year not provided — a wider range is shown.");

  // Depreciation curve: ~15% per year, flattening after 10 years.
  let value = baseLakh * 100000 * Math.pow(0.85, Math.min(age, 12));
  if (age > 12) value *= 0.85;

  const km = KM_FROM_LABEL(input.currentKm);
  if (km === undefined) {
    notes.push("Kilometres not provided — mileage adjustment could not be applied.");
  } else {
    const expected = Math.max(age, 1) * 12000;
    const delta = (expected - km) / 200000; // ±
    value *= clampFactor(1 + delta, 0.78, 1.12);
  }

  const ownerFactor: Record<string, number> = {
    "First Owner": 1.03,
    "Second Owner": 0.96,
    "Third Owner": 0.9,
    "Fourth Owner or more": 0.84,
  };
  value *= ownerFactor[input.ownership ?? ""] ?? 1;

  const conditionFactor: Record<string, number> = {
    Excellent: 1.06,
    Good: 1,
    Average: 0.92,
    "Needs Work": 0.82,
  };
  value *= conditionFactor[input.condition ?? ""] ?? 1;

  const accidentFactor: Record<string, number> = {
    "No Accident": 1.02,
    "Minor Repair": 0.95,
    "Major Repair": 0.84,
    "Not Sure": 0.95,
  };
  value *= accidentFactor[input.accidentHistory ?? ""] ?? 1;

  const serviceFactor: Record<string, number> = {
    "Full Authorised Service": 1.04,
    "Partial Records": 0.99,
    "Local Workshop": 0.95,
    "No Records": 0.91,
  };
  value *= serviceFactor[input.serviceHistory ?? ""] ?? 1;

  const tyreFactor: Record<string, number> = {
    New: 1.02,
    Good: 1,
    Average: 0.98,
    "Replacement Needed": 0.95,
  };
  value *= tyreFactor[input.tyreCondition ?? ""] ?? 1;

  if (input.fuel === "Diesel") value *= 1.02;
  if (input.fuel === "Electric") value *= 0.95;
  if (input.transmission === "Automatic") value *= 1.03;

  if (input.insuranceStatus === "Valid Comprehensive") value *= 1.01;
  if (input.insuranceStatus === "Expired") value *= 0.98;
  if (!input.hasInsuranceDoc) {
    notes.push(
      "Insurance document not provided. The estimate can still be generated, but document verification may be required before the final purchase offer.",
    );
  }

  // Range width grows when information is missing.
  const missing = notes.length;
  const spread = 0.045 + missing * 0.02;
  const round = (n: number) => Math.max(25000, Math.round(n / 5000) * 5000);

  return {
    low: round(value * (1 - spread)),
    high: round(value * (1 + spread)),
    label: "Indicative Market Estimate",
    confidence: missing === 0 ? "Moderate" : missing === 1 ? "Indicative" : "Low",
    notes,
  };
}

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
