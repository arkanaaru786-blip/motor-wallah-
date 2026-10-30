/**
 * Franchise partner flow data.
 *
 * The hierarchy the Franchise page must follow is fixed:
 *
 *   Main franchise type  ->  vehicle category grid  ->  application form
 *
 * Auto Parts and Vehicle Decor are deliberately NOT franchise categories here:
 * this flow covers dealerships and multi-brand workshops only.
 */
import bikeImage from "@/assets/homepage/Bike.png";
import busImage from "@/assets/homepage/Bus.png";
import carImage from "@/assets/homepage/Car.png";
import scvImage from "@/assets/homepage/SCV.png";
import taxiImage from "@/assets/homepage/Taxi.png";
import tractorImage from "@/assets/homepage/Tractor.png";
import threeWheelerImage from "@/assets/homepage/3 wheeler.png";
import truckImage from "@/assets/homepage/Truck.png";

export type FranchiseTypeId = "dealership" | "workshop";

export type FranchiseType = {
  id: FranchiseTypeId;
  /** Card title, exactly as the brief words it. */
  title: string;
  kicker: string;
  blurb: string;
  highlights: string[];
  cta: string;
};

export const FRANCHISE_TYPES: FranchiseType[] = [
  {
    id: "dealership",
    title: "Pre-Owned Vehicle Dealership",
    kicker: "Sell used vehicles",
    blurb:
      "Open a Motor Wallah pre-owned vehicle showroom — buy, certify and resell used vehicles in your city under our brand and process.",
    highlights: [
      "Certified pre-owned inventory and inspection process",
      "Buy, sell and exchange desk for every vehicle type",
      "Finance and insurance counter included in the setup",
    ],
    cta: "Choose Dealership",
  },
  {
    id: "workshop",
    title: "Multi-Brand Workshop",
    kicker: "Open a service centre",
    blurb:
      "Run a multi-brand service centre with Motor Wallah branding, job-card systems and a parts supply line behind you.",
    highlights: [
      "Multi-brand service, repair and periodic maintenance",
      "Genuine and OEM-grade spares supply network",
      "Insurance claim and body-shop support",
    ],
    cta: "Choose Workshop",
  },
];

export type FranchiseCategoryId =
  | "cars"
  | "bikes"
  | "three-wheelers"
  | "ev-three-wheelers"
  | "scv"
  | "trucks"
  | "buses"
  | "tractors"
  | "taxi";

export type FranchiseCategory = {
  id: FranchiseCategoryId;
  label: string;
  blurb: string;
  image: string;
  /** Flagged as a new category in the workshop grid (EV 3-wheelers). */
  isNew?: boolean;
};

/**
 * Dealership: all eight marketplace categories, including taxi / commercial
 * cars, because a dealership can retail them.
 */
const DEALERSHIP_CATEGORIES: FranchiseCategory[] = [
  {
    id: "cars",
    label: "Cars",
    blurb: "Hatchbacks, sedans, SUVs & more",
    image: carImage,
  },
  {
    id: "bikes",
    label: "Bikes",
    blurb: "Commuter, sports & scooters",
    image: bikeImage,
  },
  {
    id: "three-wheelers",
    label: "3-Wheelers",
    blurb: "Passenger & cargo",
    image: threeWheelerImage,
  },
  {
    id: "scv",
    label: "SCV / Mini Trucks",
    blurb: "Ace, Intra, Dost & more",
    image: scvImage,
  },
  {
    id: "trucks",
    label: "Trucks",
    blurb: "Heavy & medium duty",
    image: truckImage,
  },
  {
    id: "buses",
    label: "Buses",
    blurb: "Mini, mid & luxury",
    image: busImage,
  },
  {
    id: "tractors",
    label: "Tractors",
    blurb: "Farm & utility",
    image: tractorImage,
  },
  {
    id: "taxi",
    label: "Taxi / Commercial Cars",
    blurb: "Commercial & fleet vehicles",
    image: taxiImage,
  },
];

/**
 * Workshop: the same grid plus EV 3-wheelers, and deliberately WITHOUT taxi —
 * a taxi is serviced in a car workshop, so it is not its own service category.
 */
const WORKSHOP_CATEGORIES: FranchiseCategory[] = [
  {
    id: "cars",
    label: "Cars",
    blurb: "Service, repair & body work",
    image: carImage,
  },
  {
    id: "bikes",
    label: "Bikes",
    blurb: "Service, repair & detailing",
    image: bikeImage,
  },
  {
    id: "three-wheelers",
    label: "3-Wheelers",
    blurb: "Passenger & cargo service",
    image: threeWheelerImage,
  },
  {
    id: "ev-three-wheelers",
    label: "EV 3-Wheelers",
    blurb: "Electric 3-wheeler service & battery care",
    image: threeWheelerImage,
    isNew: true,
  },
  {
    id: "scv",
    label: "SCV / Mini Trucks",
    blurb: "Light commercial service",
    image: scvImage,
  },
  {
    id: "trucks",
    label: "Trucks",
    blurb: "Heavy & medium duty service",
    image: truckImage,
  },
  {
    id: "buses",
    label: "Buses",
    blurb: "Fleet & passenger bus service",
    image: busImage,
  },
  {
    id: "tractors",
    label: "Tractors",
    blurb: "Farm equipment service",
    image: tractorImage,
  },
];

export const FRANCHISE_CATEGORIES: Record<FranchiseTypeId, FranchiseCategory[]> = {
  dealership: DEALERSHIP_CATEGORIES,
  workshop: WORKSHOP_CATEGORIES,
};

export const isFranchiseTypeId = (value: unknown): value is FranchiseTypeId =>
  value === "dealership" || value === "workshop";

export const franchiseType = (id: string | undefined | null): FranchiseType | undefined =>
  FRANCHISE_TYPES.find((item) => item.id === id);

export const franchiseCategory = (
  typeId: FranchiseTypeId | undefined | null,
  categoryId: string | undefined | null,
): FranchiseCategory | undefined => {
  if (!typeId) return undefined;
  return FRANCHISE_CATEGORIES[typeId].find((item) => item.id === categoryId);
};

/** Investment capacity bands, exactly as the brief lists them. */
export const INVESTMENT_BANDS = ["₹1-5 Lakh", "₹5-10 Lakh", "₹10 Lakh+"] as const;

export const BUSINESS_AGE_OPTIONS = [
  "Starting out",
  "Less than 1 year",
  "1-3 years",
  "3-5 years",
  "5-10 years",
  "10+ years",
] as const;

export const FRANCHISE_STEPS = ["Franchise Type", "Vehicle Category", "Application"] as const;

export const FRANCHISE_RESPONSE_TIME = "24-48 hours";

/** MW-FR-1001 */
export const FRANCHISE_REFERENCE_RE = /^MW-FR-\d{4}$/;

export const isFranchiseReference = (value: string) =>
  FRANCHISE_REFERENCE_RE.test(value.trim().toUpperCase());

/** A random, unused reference ID in the MW-FR-#### format. */
export const newFranchiseReference = (taken: Iterable<string> = []): string => {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = `MW-FR-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `MW-FR-${String(Date.now()).slice(-4)}`;
};

export const franchiseWhatsAppMessage = (referenceId: string) =>
  `Hi Motor Wallah, I want to follow up on my franchise application.\nReference ID: ${referenceId}\nPlease share the next steps.`;
