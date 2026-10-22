/**
 * Service categories on the BUY hub — New Auto Parts, Second-Hand Parts,
 * Finance, Insurance and RTO.
 *
 * HONESTY: there is no partner/backend integration in this project. Every
 * record here is illustrative demo content used to build and preview the
 * marketplace layout. Cards carry a visible "Demo" tag and each category
 * carries a disclaimer; nothing here claims a live bank offer, insurer
 * quote, RTO slot or parts stock.
 */

export type BuyServiceId = "parts-new" | "parts-used" | "finance" | "insurance" | "rto";

export const BUY_SERVICE_ID_LIST: BuyServiceId[] = [
  "parts-new",
  "parts-used",
  "finance",
  "insurance",
  "rto",
];

export type BuyServiceCategory = {
  id: BuyServiceId;
  label: string;
  singular: string;
  blurb: string;
  /** Lucide icon key rendered on the hub card (no fake photographs). */
  icon: "wrench" | "cog" | "landmark" | "shield" | "file-text";
  /** Primary sidebar filter label — "Bank name" instead of vehicle brand. */
  optionLabel: string;
  options: string[];
  /** Label of the budget slider for this service type. */
  budgetLabel: string;
  /** Noun used in result headings, e.g. "5 finance offers". */
  resultNoun: string;
  disclaimer: string;
};

export type BuyServiceListing = {
  id: string;
  categoryId: BuyServiceId;
  /** Partner / provider / service name shown as the red eyebrow. */
  provider: string;
  title: string;
  blurb: string;
  /** Value of the primary sidebar filter (bank, provider, type, category). */
  option: string;
  /** Numeric upper bound used by the budget slider, in rupees. */
  priceValue: number;
  /** Human price line, e.g. "Loan up to ₹50,00,000". */
  priceLabel: string;
  city: string;
  /** Two supporting facts shown like Year/Fuel/Location on vehicle cards. */
  facts: [string, string];
};

export const BUY_SERVICE_CATEGORIES: BuyServiceCategory[] = [
  {
    id: "parts-new",
    label: "New Auto Parts",
    singular: "New part",
    blurb: "Genuine & OEM-fit parts for every category",
    icon: "cog",
    optionLabel: "Part category",
    options: [
      "Brake Components",
      "Batteries",
      "Tyres & Wheels",
      "Filters & Service Kits",
      "Lights & Electrical",
      "Body & Bumpers",
    ],
    budgetLabel: "Parts budget",
    resultNoun: "parts",
    disclaimer:
      "Illustrative parts catalogue for layout preview — stock, fitment and pricing are confirmed only after you enquire.",
  },
  {
    id: "parts-used",
    label: "Second-Hand Parts",
    singular: "Used part",
    blurb: "Condition-graded used parts & assemblies",
    icon: "wrench",
    optionLabel: "Part category",
    options: [
      "Brake Components",
      "Batteries",
      "Tyres & Wheels",
      "Filters & Service Kits",
      "Lights & Electrical",
      "Body & Bumpers",
    ],
    budgetLabel: "Parts budget",
    resultNoun: "parts",
    disclaimer:
      "Illustrative used-parts catalogue for layout preview — condition grading and availability are confirmed only after you enquire.",
  },
  {
    id: "finance",
    label: "Finance",
    singular: "Finance option",
    blurb: "Vehicle loan options across leading banks",
    icon: "landmark",
    optionLabel: "Bank name",
    options: [
      "HDFC Bank",
      "ICICI Bank",
      "State Bank of India",
      "Axis Bank",
      "Kotak Mahindra Bank",
      "Bank of Baroda",
    ],
    budgetLabel: "Loan amount",
    resultNoun: "finance offers",
    disclaimer:
      "Illustrative bank options for layout preview — these are not live offers. Rates, eligibility and sanctions come directly from the bank.",
  },
  {
    id: "insurance",
    label: "Insurance",
    singular: "Insurance option",
    blurb: "Car & bike cover, renewals and claims support",
    icon: "shield",
    optionLabel: "Provider",
    options: [
      "Acko General Insurance",
      "ICICI Lombard General",
      "Bajaj Allianz General",
      "HDFC ERGO General",
      "Tata AIG General",
    ],
    budgetLabel: "Insured value",
    resultNoun: "cover options",
    disclaimer:
      "Illustrative providers for layout preview — no quote is generated here. Premiums and cover terms are confirmed by the insurer.",
  },
  {
    id: "rto",
    label: "RTO",
    singular: "RTO service",
    blurb: "RC transfer, registration & paperwork help",
    icon: "file-text",
    optionLabel: "Service type",
    options: [
      "RC Transfer",
      "New Registration",
      "Ownership Transfer",
      "Hypothecation Removal",
      "Duplicate RC",
      "Address Update",
    ],
    budgetLabel: "Budget",
    resultNoun: "services",
    disclaimer:
      "Illustrative RTO service list for layout preview — actual fees, timelines and document needs are confirmed by the RTO desk after enquiring.",
  },
];

const CITY_POOL = ["Indore", "Bhopal", "Dewas", "Ujjain"];

const service = (
  categoryId: BuyServiceId,
  index: number,
  provider: string,
  title: string,
  option: string,
  priceValue: number,
  priceLabel: string,
  facts: [string, string],
  blurb: string,
): BuyServiceListing => ({
  id: `${categoryId}-${index + 1}`,
  categoryId,
  provider,
  title,
  blurb,
  option,
  priceValue,
  priceLabel,
  city: CITY_POOL[index % CITY_POOL.length] ?? CITY_POOL[0] ?? "Indore",
  facts,
});

export const BUY_SERVICE_LISTINGS: BuyServiceListing[] = [
  // --- Finance -------------------------------------------------------------
  service(
    "finance",
    0,
    "HDFC Bank",
    "Used car loan, up to 7 year tenure",
    "HDFC Bank",
    50_00_000,
    "Loan up to ₹50,00,000",
    ["Salaried & self-employed", "Indicative tenure 1–7 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),
  service(
    "finance",
    1,
    "ICICI Bank",
    "Pre-approved style used-car finance",
    "ICICI Bank",
    40_00_000,
    "Loan up to ₹40,00,000",
    ["Quick documentation path", "Indicative tenure 1–6 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),
  service(
    "finance",
    2,
    "State Bank of India",
    "Scheme-backed used car funding",
    "State Bank of India",
    35_00_000,
    "Loan up to ₹35,00,000",
    ["Salaried applicants", "Indicative tenure 1–7 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),
  service(
    "finance",
    3,
    "Axis Bank",
    "Fast-track loan sanction support",
    "Axis Bank",
    45_00_000,
    "Loan up to ₹45,00,000",
    ["Salaried applicants", "Indicative tenure 1–6 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),
  service(
    "finance",
    4,
    "Kotak Mahindra Bank",
    "Flexible-tenure vehicle loan",
    "Kotak Mahindra Bank",
    30_00_000,
    "Loan up to ₹30,00,000",
    ["Salaried & self-employed", "Indicative tenure 1–5 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),
  service(
    "finance",
    5,
    "Bank of Baroda",
    "Used car loan for every profile",
    "Bank of Baroda",
    40_00_000,
    "Loan up to ₹40,00,000",
    ["Salaried & self-employed", "Indicative tenure 1–7 yrs"],
    "Demo finance record — the bank confirms actual rates and eligibility.",
  ),

  // --- Insurance -----------------------------------------------------------
  service(
    "insurance",
    0,
    "Acko General Insurance",
    "Comprehensive car insurance",
    "Acko General Insurance",
    12_00_000,
    "Cover up to ₹12,00,000 IDV",
    ["Own damage + third party", "Cashless network*"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),
  service(
    "insurance",
    1,
    "ICICI Lombard General",
    "Comprehensive cover with renewal help",
    "ICICI Lombard General",
    15_00_000,
    "Cover up to ₹15,00,000 IDV",
    ["Own damage + third party", "Renewal assistance"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),
  service(
    "insurance",
    2,
    "Bajaj Allianz General",
    "Car insurance renewal & claims support",
    "Bajaj Allianz General",
    10_00_000,
    "Cover up to ₹10,00,000 IDV",
    ["Renewals & claims help", "Own damage add-ons"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),
  service(
    "insurance",
    3,
    "HDFC ERGO General",
    "New & used car insurance",
    "HDFC ERGO General",
    18_00_000,
    "Cover up to ₹18,00,000 IDV",
    ["New & used vehicles", "Own damage + third party"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),
  service(
    "insurance",
    4,
    "Tata AIG General",
    "Two-wheeler & car policy options",
    "Tata AIG General",
    8_00_000,
    "Cover up to ₹8,00,000 IDV",
    ["Cars & two-wheelers", "Third-party base cover"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),
  service(
    "insurance",
    5,
    "Acko General Insurance",
    "Two-wheeler insurance",
    "Acko General Insurance",
    2_00_000,
    "Cover up to ₹2,00,000 IDV",
    ["Bikes & scooters", "Own damage add-ons"],
    "Demo insurance record — the insurer confirms premium and cover.",
  ),

  // --- RTO -----------------------------------------------------------------
  service(
    "rto",
    0,
    "RTO service",
    "RC transfer for a used vehicle",
    "RC Transfer",
    15_000,
    "Budget up to ₹15,000",
    ["Documents checklist", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),
  service(
    "rto",
    1,
    "RTO service",
    "New vehicle registration",
    "New Registration",
    25_000,
    "Budget up to ₹25,000",
    ["Number & RC work", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),
  service(
    "rto",
    2,
    "RTO service",
    "Ownership transfer support",
    "Ownership Transfer",
    12_000,
    "Budget up to ₹12,000",
    ["Buyer & seller paperwork", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),
  service(
    "rto",
    3,
    "RTO service",
    "Hypothecation (HP) removal",
    "Hypothecation Removal",
    10_000,
    "Budget up to ₹10,000",
    ["Loan-closure paperwork", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),
  service(
    "rto",
    4,
    "RTO service",
    "Duplicate RC card",
    "Duplicate RC",
    8_000,
    "Budget up to ₹8,000",
    ["Lost/damaged RC", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),
  service(
    "rto",
    5,
    "RTO service",
    "Address update on RC",
    "Address Update",
    6_000,
    "Budget up to ₹6,000",
    ["Address proof needed", "Timeline varies by RTO"],
    "Demo RTO record — actual fee and timeline come from the RTO.",
  ),

  // --- New parts -----------------------------------------------------------
  service(
    "parts-new",
    0,
    "Demo parts counter",
    "Front axle brake pad set",
    "Brake Components",
    6_000,
    "Budget up to ₹6,000",
    ["Multi-brand fitment", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),
  service(
    "parts-new",
    1,
    "Demo parts counter",
    "Car battery, 48Ah maintenance-free",
    "Batteries",
    12_000,
    "Budget up to ₹12,000",
    ["Warranty as per brand", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),
  service(
    "parts-new",
    2,
    "Demo parts counter",
    "Set of 4 alloy wheels, 15-inch",
    "Tyres & Wheels",
    40_000,
    "Budget up to ₹40,000",
    ["Multi-brand fitment", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),
  service(
    "parts-new",
    3,
    "Demo parts counter",
    "Engine oil + filter service kit",
    "Filters & Service Kits",
    5_000,
    "Budget up to ₹5,000",
    ["Periodic service kit", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),
  service(
    "parts-new",
    4,
    "Demo parts counter",
    "LED headlamp set",
    "Lights & Electrical",
    9_000,
    "Budget up to ₹9,000",
    ["Multi-brand fitment", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),
  service(
    "parts-new",
    5,
    "Demo parts counter",
    "Front bumper, primed",
    "Body & Bumpers",
    14_000,
    "Budget up to ₹14,000",
    ["Multi-brand fitment", "Condition: new"],
    "Demo parts record — fitment and price are confirmed after enquiring.",
  ),

  // --- Used parts -----------------------------------------------------------
  service(
    "parts-used",
    0,
    "Demo parts counter",
    "Used front bumper, condition graded",
    "Body & Bumpers",
    6_000,
    "Budget up to ₹6,000",
    ["Condition: Grade A", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
  service(
    "parts-used",
    1,
    "Demo parts counter",
    "Used alloy wheel set, 4 pieces",
    "Tyres & Wheels",
    18_000,
    "Budget up to ₹18,000",
    ["Condition: Grade A", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
  service(
    "parts-used",
    2,
    "Demo parts counter",
    "Used headlamp assembly",
    "Lights & Electrical",
    7_000,
    "Budget up to ₹7,000",
    ["Condition: Grade B", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
  service(
    "parts-used",
    3,
    "Demo parts counter",
    "Used AC compressor",
    "Filters & Service Kits",
    9_000,
    "Budget up to ₹9,000",
    ["Condition: Grade B", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
  service(
    "parts-used",
    4,
    "Demo parts counter",
    "Used car battery, tested",
    "Batteries",
    4_000,
    "Budget up to ₹4,000",
    ["Condition: tested", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
  service(
    "parts-used",
    5,
    "Demo parts counter",
    "Used brake calipers, pair",
    "Brake Components",
    5_000,
    "Budget up to ₹5,000",
    ["Condition: Grade A", "Multi-brand fitment"],
    "Demo parts record — condition and price are confirmed after enquiring.",
  ),
];

export const getBuyServiceCategory = (id: string | undefined | null) =>
  BUY_SERVICE_CATEGORIES.find((c) => c.id === id);

export const isBuyServiceId = (value: unknown): value is BuyServiceId =>
  typeof value === "string" && BUY_SERVICE_ID_LIST.includes(value as BuyServiceId);

export const serviceListingsInCategory = (categoryId: BuyServiceId) =>
  BUY_SERVICE_LISTINGS.filter((l) => l.categoryId === categoryId);

export const serviceOptionsInCategory = (categoryId: BuyServiceId) =>
  getBuyServiceCategory(categoryId)?.options ?? [];

export const serviceCitiesInCategory = (categoryId: BuyServiceId) =>
  Array.from(new Set(serviceListingsInCategory(categoryId).map((l) => l.city))).sort((a, b) =>
    a.localeCompare(b),
  );

/** Budget slider bounds in rupees for a service category. */
export const servicePriceBounds = (categoryId: BuyServiceId) => {
  const prices = serviceListingsInCategory(categoryId).map((l) => l.priceValue);
  if (!prices.length) return { min: 0, max: 100000, step: 1000 };
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const span = rawMax - rawMin;
  const step = span > 1000000 ? 100000 : span > 200000 ? 10000 : 1000;
  return {
    min: Math.max(0, Math.floor(rawMin / step) * step),
    max: Math.ceil(rawMax / step) * step,
    step,
  };
};

export const serviceListingName = (l: BuyServiceListing) => `${l.title} · ${l.provider}`;
