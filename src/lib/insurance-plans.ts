/**
 * Vehicle insurance — insurer comparison data and the (mock) premium maths.
 *
 * Premiums are indicative sample values for this preview: they are derived
 * from the vehicle category, its age, the policy type and the NCB declaration,
 * and they are deliberately proportional so the comparison behaves sensibly
 * for every one of the eight categories. A real quote is always issued by the
 * insurer after inspection.
 */
import type { BuyCategoryId } from "@/lib/buy-catalog";

import hdfcErgoLogo from "@/assets/insurance/hdfc-ergo.png";
import tataAigLogo from "@/assets/insurance/tata-aig.png";

export type PolicyType = "comprehensive" | "third-party";

export const POLICY_TYPES: { id: PolicyType; label: string; blurb: string }[] = [
  {
    id: "comprehensive",
    label: "Comprehensive",
    blurb: "Own damage + third party",
  },
  {
    id: "third-party",
    label: "Third Party",
    blurb: "Mandatory legal cover",
  },
];

export type Insurer = {
  id: string;
  /** Public brand name — never an invented label. */
  name: string;
  /** Locally stored official mark; wordmark fallback when absent. */
  logo?: string | undefined;
  /** Relative price level for this sample comparison. */
  factor: number;
  badge?: string | undefined;
  features: string[];
};

/**
 * The four insurers in the comparison. Pricing keeps the brief's ordering:
 * Bajaj Allianz lowest, then ICICI Lombard, Tata AIG and HDFC ERGO (which
 * includes zero-depreciation cover).
 */
export const INSURERS: Insurer[] = [
  {
    id: "bajaj-allianz",
    name: "Bajaj Allianz",
    factor: 0.89,
    badge: "Lowest premium",
    features: ["Lowest premium in this quote", "Cashless network garages", "24×7 claim helpline"],
  },
  {
    id: "icici-lombard",
    name: "ICICI Lombard",
    factor: 0.95,
    badge: "Most chosen",
    features: ["Cashless network garages", "Self-inspection claim filing", "24×7 claim helpline"],
  },
  {
    id: "tata-aig",
    name: "Tata AIG",
    factor: 0.97,
    features: ["Cashless network garages", "Roadside assistance add-on", "24×7 claim helpline"],
  },
  {
    id: "hdfc-ergo",
    name: "HDFC ERGO",
    logo: hdfcErgoLogo,
    factor: 1.02,
    badge: "₹0 Dep included",
    features: [
      "Zero depreciation cover included",
      "Cashless network garages",
      "24×7 claim helpline",
    ],
  },
];

const INSURER_LOGO_OVERRIDES: Record<string, string> = {
  "tata-aig": tataAigLogo,
};

export const insurerLogo = (insurer: Insurer): string | undefined =>
  insurer.logo ?? INSURER_LOGO_OVERRIDES[insurer.id];

export const getInsurer = (id: string | undefined): Insurer | undefined =>
  INSURERS.find((insurer) => insurer.id === id);

/* ------------------------------ Smart rules ------------------------------ */

export const CURRENT_YEAR = new Date().getFullYear();

/** Comprehensive cover is not offered once a vehicle crosses ten years. */
export const MAX_COMPREHENSIVE_AGE = 10;

export const vehicleAge = (year: number) => Math.max(0, CURRENT_YEAR - year);

export const isThirdPartyOnly = (year: number) => vehicleAge(year) > MAX_COMPREHENSIVE_AGE;

export const OLD_VEHICLE_NOTE =
  "Vehicles older than 10 years can only be insured third-party — comprehensive (own damage) cover is not available, so the plan has been set to Third Party.";

/**
 * Brands that no longer sell vehicles in India. Some insurers reject them or
 * load the premium because spare-part and service support is limited.
 */
export const DISCONTINUED_BRANDS = ["Chevrolet", "Datsun"] as const;

export const isDiscontinuedBrand = (brand: string) =>
  (DISCONTINUED_BRANDS as readonly string[]).includes(brand);

export const DISCONTINUED_BRAND_WARNING =
  "Chevrolet and Datsun stopped selling new vehicles in India. Some insurers reject these brands or load the premium, since spare parts and authorised service support are limited — we will confirm which partners will cover your vehicle.";

/* ---------------------------- Premium maths ---------------------------- */

/** Indicative insured-declared value of a new vehicle, per category. */
const IDV_BASE: Record<BuyCategoryId, number> = {
  cars: 260000,
  bikes: 60000,
  "three-wheelers": 155000,
  scv: 330000,
  trucks: 1150000,
  buses: 1450000,
  tractors: 290000,
  taxi: 240000,
};

/** Statutory third-party premium (sample rates per category). */
const THIRD_PARTY: Record<BuyCategoryId, number> = {
  cars: 2094,
  bikes: 1193,
  "three-wheelers": 2373,
  scv: 5900,
  trucks: 11800,
  buses: 14200,
  tractors: 3900,
  taxi: 2900,
};

/** Own-damage rate applied to the IDV, per category. */
const OWN_DAMAGE_RATE: Record<BuyCategoryId, number> = {
  cars: 0.021,
  bikes: 0.032,
  "three-wheelers": 0.025,
  scv: 0.028,
  trucks: 0.024,
  buses: 0.024,
  tractors: 0.022,
  taxi: 0.023,
};

/** No-claim bonus declared by the customer, off the own-damage premium. */
export const NCB_DISCOUNT = 0.2;

/** 8% a year, never below 35% of the new-vehicle value. */
const DEPRECIATION_PER_YEAR = 0.08;
const DEPRECIATION_FLOOR = 0.35;

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export const idvFor = (categoryId: BuyCategoryId, year: number) => {
  const retained = Math.max(DEPRECIATION_FLOOR, 1 - DEPRECIATION_PER_YEAR * vehicleAge(year));
  return roundTo(IDV_BASE[categoryId] * retained, 1000);
};

export type QuoteInput = {
  categoryId: BuyCategoryId;
  year: number;
  policyType: PolicyType;
  ncb: boolean;
};

export type PremiumBreakdown = {
  idv: number;
  /** Own-damage premium (0 for third-party cover). */
  ownDamage: number;
  /** Statutory third-party premium. */
  thirdParty: number;
  /** Money taken off by the declared no-claim bonus. */
  ncbSaving: number;
  /** Base premium before the insurer's own pricing level. */
  base: number;
};

/** Base premium for the inputs — before each insurer's relative pricing. */
export const premiumBreakdown = (input: QuoteInput): PremiumBreakdown => {
  const idv = idvFor(input.categoryId, input.year);
  const thirdParty = THIRD_PARTY[input.categoryId];

  if (input.policyType === "third-party") {
    return { idv, ownDamage: 0, thirdParty, ncbSaving: 0, base: thirdParty };
  }

  const ownDamage = roundTo(idv * OWN_DAMAGE_RATE[input.categoryId], 1);
  const ncbSaving = input.ncb ? roundTo(ownDamage * NCB_DISCOUNT, 1) : 0;
  return {
    idv,
    ownDamage,
    thirdParty,
    ncbSaving,
    base: ownDamage - ncbSaving + thirdParty,
  };
};

/** What a specific insurer charges for these inputs (₹, rounded to tens). */
export const premiumFor = (insurer: Insurer, input: QuoteInput) =>
  roundTo(premiumBreakdown(input).base * insurer.factor, 10);

export type InsurerQuote = {
  insurer: Insurer;
  premium: number;
  /** Cheapest option in the current comparison. */
  best: boolean;
};

export const quotesFor = (input: QuoteInput): InsurerQuote[] => {
  const priced = INSURERS.map((insurer) => ({ insurer, premium: premiumFor(insurer, input) }));
  const cheapest = Math.min(...priced.map((q) => q.premium));
  return priced.map((quote) => ({ ...quote, best: quote.premium === cheapest }));
};

export const lowestPremium = (input: QuoteInput) =>
  Math.min(...INSURERS.map((insurer) => premiumFor(insurer, input)));
