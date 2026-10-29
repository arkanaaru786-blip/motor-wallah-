/**
 * Vehicle Finance — lender catalogue, KYC option lists and EMI maths.
 *
 * Everything here is a real, named institution (no invented lenders). Logos are
 * locally stored official marks; anything without artwork falls back to the
 * same typographic wordmark convention BrandArt uses for vehicle brands.
 *
 * Partner groupings per vehicle category follow the Motor Wallah brief:
 * Banks for applicants with a good CIBIL score, NBFCs for easy approval.
 */
import type { BuyCategoryId } from "@/lib/buy-catalog";

import hdfc from "@/assets/finance/hdfc-bank.png";
import icici from "@/assets/finance/icici-bank.png";
import axis from "@/assets/finance/axis-bank.png";
import kotak from "@/assets/finance/kotak-mahindra-bank.png";
import sbi from "@/assets/finance/state-bank-of-india.png";
import bob from "@/assets/finance/bank-of-baroda.png";
import pnb from "@/assets/finance/punjab-national-bank.png";
import au from "@/assets/finance/au-small-finance-bank.png";
import mahindraFinance from "@/assets/finance/mahindra-mahindra-financial-services.png";
import tataCapital from "@/assets/finance/tata-capital.png";
import hdb from "@/assets/finance/hdb-financial-services.png";
import iifl from "@/assets/finance/iifl-finance.png";
import chola from "@/assets/finance/cholamandalam-investment-and-finance-company.png";
import sundaram from "@/assets/finance/sundaram-finance.jpg";
import poonawalla from "@/assets/finance/poonawalla-fincorp.png";
import adityaBirla from "@/assets/finance/aditya-birla-capital.png";
import bajaj from "@/assets/finance/bajaj-finance.png";
import tvs from "@/assets/finance/tvs-credit.png";
import heroFincorp from "@/assets/finance/hero-fincorp.png";
import muthoot from "@/assets/finance/muthoot-finance.png";

export type LenderKind = "bank" | "nbfc";

export type Lender = {
  id: string;
  /** Public name of the institution — never an invented label. */
  name: string;
  kind: LenderKind;
  logo?: string | undefined;
};

const lender = (id: string, name: string, kind: LenderKind, logo?: string): Lender => ({
  id,
  name,
  kind,
  logo,
});

/** Every partner the site knows about — powers the "View All Partners" list. */
export const ALL_LENDERS: Lender[] = [
  // --- Banks (for good CIBIL) -------------------------------------------
  lender("hdfc", "HDFC Bank", "bank", hdfc),
  lender("icici", "ICICI Bank", "bank", icici),
  lender("axis", "Axis Bank", "bank", axis),
  lender("kotak", "Kotak Mahindra Bank", "bank", kotak),
  lender("sbi", "State Bank of India", "bank", sbi),
  lender("bob", "Bank of Baroda", "bank", bob),
  lender("pnb", "Punjab National Bank", "bank", pnb),
  lender("au", "AU Small Finance Bank", "bank", au),
  lender("canara", "Canara Bank", "bank"),
  lender("federal", "Federal Bank", "bank"),
  lender("idfc", "IDFC FIRST Bank", "bank"),
  lender("yes", "Yes Bank", "bank"),

  // --- NBFCs (for low CIBIL / easy approval) ----------------------------
  lender("mahindra", "Mahindra Finance", "nbfc", mahindraFinance),
  lender("tata-capital", "Tata Capital", "nbfc", tataCapital),
  lender("shriram", "Shriram Finance", "nbfc"),
  lender("hdb", "HDB Financial Services", "nbfc", hdb),
  lender("iifl", "IIFL Finance", "nbfc", iifl),
  lender("tata-motors-finance", "Tata Motors Finance", "nbfc"),
  lender("piaggio", "Piaggio Finance", "nbfc"),
  lender("kinara", "Kinara Capital", "nbfc"),
  lender("ugro", "UGRO Capital", "nbfc"),
  lender("chola", "Chola Mandalam", "nbfc", chola),
  lender("lt", "L&T Finance", "nbfc"),
  lender("sundaram", "Sundaram Finance", "nbfc", sundaram),
  lender("poonawalla", "Poonawalla Fincorp", "nbfc", poonawalla),
  lender("aditya-birla", "Aditya Birla Capital", "nbfc", adityaBirla),
  lender("srei", "Srei Equipment Finance", "nbfc"),
  lender("varthana", "Varthana", "nbfc"),
  lender("bajaj", "Bajaj Finance", "nbfc", bajaj),
  lender("tvs-credit", "TVS Credit", "nbfc", tvs),
  lender("hero-fincorp", "Hero FinCorp", "nbfc", heroFincorp),
  lender("muthoot", "Muthoot Finance", "nbfc", muthoot),
  lender("manappuram", "Manappuram Finance", "nbfc"),
  lender("arman", "Arman Finance", "nbfc"),
];

const LENDER_BY_ID = new Map(ALL_LENDERS.map((l) => [l.id, l]));

export const getLender = (id: string): Lender | undefined => LENDER_BY_ID.get(id);

export const lendersByIds = (ids: readonly string[]): Lender[] =>
  ids.map((id) => LENDER_BY_ID.get(id)).filter((l): l is Lender => Boolean(l));

/** The 8 vehicle categories the finance flow supports. */
export type FinanceCategoryId = BuyCategoryId;

export type CategoryLenders = {
  /** Top options for applicants with a good CIBIL score. */
  banks: string[];
  /** Top options for low CIBIL / easy approval. */
  nbfc: string[];
};

/**
 * Top 5–6 partners per category (the brief's exact grouping).
 * Bikes are NBFC-only — banks rarely write two-wheeler loans directly.
 */
export const CATEGORY_LENDERS: Record<FinanceCategoryId, CategoryLenders> = {
  cars: {
    banks: ["hdfc", "icici", "axis", "kotak"],
    nbfc: ["mahindra", "tata-capital", "shriram", "hdb", "iifl"],
  },
  bikes: {
    banks: [],
    nbfc: ["hdb", "bajaj", "tvs-credit", "hero-fincorp", "iifl"],
  },
  "three-wheelers": {
    banks: ["sbi", "bob"],
    nbfc: ["shriram", "mahindra", "piaggio", "kinara", "ugro"],
  },
  scv: {
    banks: ["hdfc", "icici"],
    nbfc: ["tata-motors-finance", "mahindra", "chola", "au", "lt"],
  },
  trucks: {
    banks: ["sbi", "hdfc", "axis"],
    nbfc: ["shriram", "chola", "sundaram", "poonawalla", "aditya-birla"],
  },
  buses: {
    banks: ["sbi", "hdfc", "axis"],
    nbfc: ["shriram", "chola", "sundaram", "poonawalla", "aditya-birla"],
  },
  tractors: {
    banks: ["sbi", "pnb"],
    nbfc: ["mahindra", "shriram", "srei", "varthana"],
  },
  // Commercial cars are financed like used cars.
  taxi: {
    banks: ["hdfc", "icici", "axis", "kotak"],
    nbfc: ["mahindra", "tata-capital", "shriram", "hdb", "iifl"],
  },
};

/* ------------------------------ KYC options ------------------------------ */

export const CIBIL_RANGES = [
  "Excellent (750 & above)",
  "Good (700 – 749)",
  "Average (650 – 699)",
  "Poor / No Score",
] as const;

/** Selecting this range highlights the NBFC tab after submission. */
export const LOW_CIBIL_RANGE = "Poor / No Score";

export const OCCUPATIONS = [
  "Salaried",
  "Self-Employed / Business",
  "Professional",
  "Farmer",
  "Transport / Fleet Operator",
  "Retired",
  "Other",
] as const;

export const RESIDENTIAL_STATUSES = ["Resident Indian", "NRI", "PIO / OCI"] as const;

export const OWNER_SERIAL_OPTIONS = [
  "1st Owner",
  "2nd Owner",
  "3rd Owner",
  "4th Owner or more",
] as const;

/**
 * Brands that no longer manufacture vehicles in India — the form warns the
 * applicant that finance options and spare-part support work differently.
 */
export const DISCONTINUED_BRANDS = ["Chevrolet", "Datsun"] as const;

export const isDiscontinuedBrand = (brand: string) =>
  (DISCONTINUED_BRANDS as readonly string[]).includes(brand);

export const DISCONTINUED_BRAND_WARNING =
  "Chevrolet and Datsun have stopped selling new vehicles in India. Loans are still possible on well-maintained used examples, but approval, valuation and spare-part support vary — our team will confirm eligibility for you.";

/* -------------------------------- EMI maths -------------------------------- */

export const LOAN_TENURES = [12, 24, 36, 48, 60, 72, 84] as const;
export const DEFAULT_RATE = 11.5;

/** Standard reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1). */
export const monthlyEmi = (principal: number, annualRatePercent: number, months: number) => {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / months;
  const factor = (1 + r) ** months;
  return (principal * r * factor) / (factor - 1);
};

export type EmiBreakdown = {
  principal: number;
  emi: number;
  totalPayable: number;
  totalInterest: number;
};

export const emiBreakdown = (
  principal: number,
  annualRatePercent: number,
  months: number,
): EmiBreakdown => {
  const emi = monthlyEmi(principal, annualRatePercent, months);
  const totalPayable = emi * months;
  return {
    principal,
    emi,
    totalPayable,
    totalInterest: Math.max(0, totalPayable - principal),
  };
};
