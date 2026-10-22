import {
  BRAND_NAMES,
  FUEL_TYPES,
  TRANSMISSION_TYPES,
  YEAR_OPTIONS,
} from "@/lib/vehicle-catalog";
import placeholderHatchback from "@/assets/placeholder-hatchback.jpg";

import placeholderSedan from "@/assets/placeholder-sedan.jpg";
import placeholderSuv from "@/assets/placeholder-suv.jpg";
import placeholderMuv from "@/assets/placeholder-muv.jpg";

export type VehicleStatus = "Available" | "Reserved" | "Sold";
export type BodyType = "Hatchback" | "Sedan" | "SUV" | "MUV";
export type InspectionResult = "Passed" | "Attention Required" | "Not Applicable" | "Not Inspected";

/** The 17 inspection groups that make up the Motor Wallah 150+ point check. */
export const INSPECTION_CATEGORIES = [
  "Engine",
  "Transmission",
  "Brakes",
  "Suspension",
  "Steering",
  "Tyres",
  "Exterior",
  "Interior",
  "Electrical",
  "AC / Climate Control",
  "Lights",
  "Safety",
  "Infotainment",
  "Underbody",
  "Road Test",
  "OBD / Diagnostics",
  "Document Verification",
] as const;

export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number];

export type InspectionItem = {
  category: InspectionCategory;
  points: number;
  result: InspectionResult;
  note: string | null;
};

export type InspectionReport = {
  /** true only for real, physically inspected vehicles. */
  verified: boolean;
  totalPoints: number;
  /** 0–100, or null when no inspection data exists. */
  score: number | null;
  inspectedOn: string | null;
  inspectedBy: string | null;
  certificationId: string | null;
  items: InspectionItem[];
};

/**
 * Scalable vehicle model — mirrors the shape a future Motor Wallah
 * admin / franchise database would return. Unknown values stay `null`
 * so the UI can render "Not Available" instead of inventing data.
 */
export type Vehicle = {
  id: string;
  /** SEO slug used in the URL, e.g. 2022-hyundai-creta-sx */
  slug: string;
  status: VehicleStatus;
  demo: boolean;
  featured: boolean;
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number; // in ₹ lakh
  kilometres: number;
  fuel: string;
  transmission: string;
  bodyType: BodyType;
  location: string;
  franchiseId: string | null;
  images: string[];
  description: string | null;
  features: string[];
  certified: boolean;
  inspection: InspectionReport | null;
  // History — never fabricated
  registrationYear: number | null;
  registration: string | null;
  ownership: string | null;
  insuranceValidity: string | null;
  serviceHistory: string | null;
  accidentHistory: string | null;
  rcStatus: string | null;
  challanStatus: string | null;
  hypothecationStatus: string | null;
  pucStatus: string | null;
  rto: string | null;
  // Condition
  exteriorCondition: string | null;
  interiorCondition: string | null;
  engineCondition: string | null;
  tyres: string | null;
  // Commercial
  financeAvailable: boolean;
  insuranceAssistance: boolean;
  warrantyProvider: string | null;
  documents: { label: string; verified: boolean }[];
  createdAt: string;
};

const bodyPlaceholder: Record<BodyType, string> = {
  Hatchback: placeholderHatchback,
  Sedan: placeholderSedan,
  SUV: placeholderSuv,
  MUV: placeholderMuv,
};

const bodyGallery: Record<BodyType, string[]> = {
  // Neutral, brand-neutral demo placeholders only — never a mismatched brand photo.
  Hatchback: [placeholderHatchback],
  Sedan: [placeholderSedan],
  SUV: [placeholderSuv],
  MUV: [placeholderMuv],
};

export const placeholderFor = (bodyType: BodyType) => bodyPlaceholder[bodyType];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Deterministic demo inspection report — clearly labelled as demo everywhere it is shown. */
const demoInspection = (seed: number): InspectionReport => {
  const items: InspectionItem[] = INSPECTION_CATEGORIES.map((category, i) => {
    const mod = (seed * 7 + i * 3) % 11;
    const result: InspectionResult =
      mod === 0 ? "Attention Required" : mod === 5 && category === "Infotainment" ? "Not Applicable" : "Passed";
    return {
      category,
      points: 9,
      result,
      note: result === "Attention Required" ? "Minor wear noted in the demo report" : null,
    };
  });
  const applicable = items.filter((i) => i.result !== "Not Applicable");
  const passed = applicable.filter((i) => i.result === "Passed").length;
  return {
    verified: false,
    totalPoints: 153,
    score: Math.round((passed / applicable.length) * 100),
    inspectedOn: null,
    inspectedBy: null,
    certificationId: null,
    items,
  };
};

type DemoInput = Pick<
  Vehicle,
  | "id"
  | "status"
  | "make"
  | "model"
  | "variant"
  | "year"
  | "price"
  | "kilometres"
  | "fuel"
  | "transmission"
  | "bodyType"
  | "location"
  | "createdAt"
> & { featured?: boolean; ownership?: string; registrationYear?: number };

const demo = (v: DemoInput, seed: number): Vehicle => ({
  ...v,
  slug: slugify(`${v.year} ${v.make} ${v.model} ${v.variant}`),
  demo: true,
  featured: v.featured ?? false,
  franchiseId: null,
  images: bodyGallery[v.bodyType],
  description: null,
  features: [],
  certified: false,
  inspection: demoInspection(seed),
  registrationYear: v.registrationYear ?? null,
  registration: null,
  ownership: v.ownership ?? null,
  insuranceValidity: null,
  serviceHistory: null,
  accidentHistory: null,
  rcStatus: null,
  challanStatus: null,
  hypothecationStatus: null,
  pucStatus: null,
  rto: null,
  exteriorCondition: null,
  interiorCondition: null,
  engineCondition: null,
  tyres: null,
  financeAvailable: true,
  insuranceAssistance: true,
  warrantyProvider: null,
  documents: [
    { label: "RC", verified: false },
    { label: "Insurance", verified: false },
    { label: "PUC", verified: false },
    { label: "Service records", verified: false },
    { label: "Invoice / purchase documents", verified: false },
  ],
  createdAt: v.createdAt,
});

export const VEHICLES: Vehicle[] = [
  demo({ id: "mw-01", status: "Available", make: "Maruti Suzuki", model: "Baleno", variant: "Zeta", year: 2022, price: 7.4, kilometres: 21600, fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", location: "Indore", createdAt: "2026-07-28", featured: true, ownership: "First Owner" }, 1),
  demo({ id: "mw-02", status: "Available", make: "Hyundai", model: "i20", variant: "Asta", year: 2021, price: 7.85, kilometres: 32400, fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", location: "Bhopal", createdAt: "2026-07-22", ownership: "First Owner" }, 2),
  demo({ id: "mw-03", status: "Available", make: "Hyundai", model: "Creta", variant: "SX", year: 2022, price: 12.5, kilometres: 45000, fuel: "Petrol", transmission: "Automatic", bodyType: "SUV", location: "Indore", createdAt: "2026-08-04", featured: true, ownership: "Second Owner" }, 3),
  demo({ id: "mw-04", status: "Reserved", make: "Maruti Suzuki", model: "Ertiga", variant: "ZXI CNG", year: 2021, price: 9.6, kilometres: 54800, fuel: "CNG", transmission: "Manual", bodyType: "MUV", location: "Ujjain", createdAt: "2026-07-10", ownership: "Second Owner" }, 4),
  demo({ id: "mw-05", status: "Available", make: "Tata", model: "Nexon", variant: "XZ+", year: 2021, price: 9.1, kilometres: 33250, fuel: "Diesel", transmission: "Manual", bodyType: "SUV", location: "Indore", createdAt: "2026-08-01", ownership: "First Owner" }, 5),
  demo({ id: "mw-06", status: "Available", make: "Mahindra", model: "Scorpio-N", variant: "Z8", year: 2022, price: 18.2, kilometres: 29800, fuel: "Diesel", transmission: "Manual", bodyType: "SUV", location: "Indore", createdAt: "2026-08-08", featured: true, ownership: "First Owner" }, 6),
  demo({ id: "mw-07", status: "Sold", make: "Tata", model: "Altroz", variant: "XT", year: 2020, price: 6.25, kilometres: 41200, fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", location: "Dewas", createdAt: "2026-06-30", ownership: "Second Owner" }, 7),
];

export const PRICE_RANGES = [
  { label: "Under ₹5 Lakh", min: 0, max: 5 },
  { label: "₹5–10 Lakh", min: 5, max: 10 },
  { label: "₹10–20 Lakh", min: 10, max: 20 },
  { label: "₹20 Lakh+", min: 20, max: Infinity },
];


export const KM_RANGES = [
  { label: "Under 25,000 km", min: 0, max: 25000 },
  { label: "25,000 – 50,000 km", min: 25000, max: 50000 },
  { label: "50,000 km+", min: 50000, max: Infinity },
];

export const FUELS = [...FUEL_TYPES];
export const TRANSMISSIONS = [...TRANSMISSION_TYPES];
export const BODY_TYPES: BodyType[] = ["Hatchback", "Sedan", "SUV", "MUV"];
export const LOCATIONS = ["Indore", "Bhopal", "Ujjain", "Dewas", "Other Motor Wallah locations"];
export const OWNERSHIPS = ["First Owner", "Second Owner", "Third Owner"];
export const AVAILABILITY: VehicleStatus[] = ["Available", "Reserved", "Sold"];

/** Brand/model/year options come from the central catalogue, never from listing data. */
export const BRANDS = BRAND_NAMES;
export const YEARS = YEAR_OPTIONS;


export const vehicleName = (v: Vehicle) => `${v.year} ${v.make} ${v.model} ${v.variant}`;
export const formatPrice = (lakh: number) => `₹${lakh.toFixed(2)} Lakh`;
export const formatKm = (km: number) => `${km.toLocaleString("en-IN")} km`;
/** Accepts either the SEO slug or the internal id. */
export const getVehicle = (key: string) => VEHICLES.find((v) => v.slug === key || v.id === key);
export const ON_REQUEST = "Available on request";
export const NOT_AVAILABLE = "Not Available";
export const TO_BE_VERIFIED = "To Be Verified";
