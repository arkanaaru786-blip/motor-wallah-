/**
 * AUTO PARTS e-commerce store.
 *
 * Deterministic mock catalogue powering the /accessories flow:
 * Vehicle Category → Brand → Model → Parts Category → Product Grid.
 *
 * Products are generated (deterministically, from a string hash) for the
 * chosen vehicle brand/model + parts category, so the same selection always
 * shows the same shelf. Prices are illustrative — real stock and pricing are
 * confirmed by the Motor Wallah team after the prepaid order is placed.
 */
import {
  Activity,
  Car,
  Circle,
  Cog,
  Gauge,
  Lightbulb,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type PartCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /** Vendor / manufacturer names used in generated product names. */
  vendors: string[];
  /** Catalogue item names, e.g. "Front Brake Pad Set". */
  items: string[];
  /** Illustrative price band, rupees. */
  min: number;
  max: number;
};

export const PART_CATEGORY_LIST: PartCategory[] = [
  {
    id: "engine",
    label: "Engine Parts",
    icon: Cog,
    blurb: "Filters, plugs, belts & mounts",
    vendors: ["Bosch", "Mahle", "NGK", "Elring", "SKF"],
    items: [
      "Oil Filter",
      "Air Filter",
      "Spark Plug Set",
      "Timing Belt Kit",
      "Engine Mount",
      "Fuel Filter",
    ],
    min: 249,
    max: 6499,
  },
  {
    id: "brakes",
    label: "Brakes",
    icon: Gauge,
    blurb: "Pads, discs, shoes & fluid",
    vendors: ["Bosch", "Brembo", "TVS Girling", "Textar", "Ferodo"],
    items: [
      "Front Brake Pad Set",
      "Brake Disc Rotor",
      "Brake Shoe Set",
      "Brake Caliper",
      "Brake Fluid DOT 4",
    ],
    min: 399,
    max: 7999,
  },
  {
    id: "suspension",
    label: "Suspension",
    icon: Activity,
    blurb: "Shocks, struts & bushes",
    vendors: ["Monroe", "Gabriel", "KYB", "Lemförder", "Sachs"],
    items: [
      "Front Shock Absorber",
      "Strut Mount Kit",
      "Leaf Spring Set",
      "Control Arm",
      "Stabiliser Link",
    ],
    min: 699,
    max: 9999,
  },
  {
    id: "electricals",
    label: "Electricals",
    icon: Zap,
    blurb: "Batteries, alternators & coils",
    vendors: ["Bosch", "Amaron", "Exide", "Lucas-TVA", "Minda"],
    items: [
      "Battery 12V",
      "Alternator",
      "Starter Motor",
      "Ignition Coil",
      "Wiring Harness",
    ],
    min: 599,
    max: 12999,
  },
  {
    id: "body",
    label: "Body Parts",
    icon: Car,
    blurb: "Bumpers, mirrors & panels",
    vendors: ["OEM Fit", "Steelcraft", "Stylo", "DCM", "Varroc"],
    items: [
      "Front Bumper",
      "ORVM Mirror Pair",
      "Door Handle Set",
      "Bonnet Hinge Kit",
      "Mud Flap Set",
    ],
    min: 349,
    max: 8999,
  },
  {
    id: "lights",
    label: "Lights",
    icon: Lightbulb,
    blurb: "Headlamps, LEDs & fog lamps",
    vendors: ["Hella", "Osram", "Philips", "Uno Minda", "Depo"],
    items: [
      "LED Headlight Pair",
      "Halogen Bulb H4",
      "Fog Lamp Set",
      "Tail Light Assembly",
      "DRL Strip",
    ],
    min: 299,
    max: 6999,
  },
  {
    id: "tyres",
    label: "Tyres & Wheels",
    icon: Circle,
    blurb: "Tyres, caps & wheel weights",
    vendors: ["MRF", "Apollo", "CEAT", "Michelin", "JK Tyre"],
    items: [
      "Tubeless Tyre 185/65 R15",
      "Tubeless Tyre 205/55 R16",
      "Wheel Cap Set",
      "Wheel Weight Kit",
    ],
    min: 2499,
    max: 14999,
  },
  {
    id: "accessories",
    label: "Accessories",
    icon: Sparkles,
    blurb: "Covers, mats & cabin add-ons",
    vendors: ["3M", "AutoEngineme", "WiZR", "Nitek", "Bosch"],
    items: [
      "Seat Cover Set",
      "Floor Mat Set",
      "Car Vacuum 12V",
      "Mobile Phone Mount",
      "Steering Wheel Cover",
    ],
    min: 199,
    max: 4999,
  },
];

export const getPartCategory = (id: string | undefined | null) =>
  PART_CATEGORY_LIST.find((c) => c.id === id);

export type Product = {
  id: string;
  name: string;
  vendor: string;
  price: number;
  mrp: number;
  discount: number;
  rating: number;
  reviews: number;
  condition: "New" | "Used";
  /** Days until delivery, shown as an arrival date. */
  etaDays: number;
  assured: boolean;
};

/** Deterministic 32-bit hash so the same selection always shows the same shelf. */
const hash = (seed: string) => {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
};

/** Generates the product shelf for a vehicle + parts-category selection. */
export function buildProducts(
  partId: string,
  brand: string,
  model: string,
): Product[] {
  const category = getPartCategory(partId);
  if (!category) return [];

  const count = 9;
  const products: Product[] = [];
  for (let i = 0; i < count; i += 1) {
    const vendor = category.vendors[i % category.vendors.length]!;
    const item = category.items[i % category.items.length]!;
    const seed = hash(`${partId}|${brand}|${model}|${i}`);
    const span = category.max - category.min;
    const price = Math.round((category.min + (span * (seed % 1000)) / 1000) / 10) * 10 - 1;
    const discount = 5 + (seed % 36); // 5% – 40%
    const mrp = Math.round((price / (1 - discount / 100)) / 10) * 10;
    const condition: Product["condition"] = seed % 7 === 0 ? "Used" : "New";

    products.push({
      id: `${partId}-${i}`,
      name: `${vendor} ${item} for ${model}`,
      vendor,
      price,
      mrp,
      discount,
      rating: Math.round((3.6 + ((seed >> 3) % 14) / 10) * 10) / 10,
      reviews: 40 + (seed % 1800),
      condition,
      etaDays: 2 + ((seed >> 5) % 5),
      assured: seed % 3 !== 0,
    });
  }
  // Cheapest first, like a storefront default sort.
  return products.sort((a, b) => a.price - b.price);
}

/* -------------------------------------------------------------------------- */
/* Cart — persisted per device so the drawer survives step navigation.        */
/* -------------------------------------------------------------------------- */
export type CartLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  partLabel: string;
};

const CART_KEY = "mw_parts_cart";

export const readCart = (): CartLine[] => {
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as CartLine[];
  } catch {
    return [];
  }
};

export const writeCart = (lines: CartLine[]): void => {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(lines.slice(0, 30)));
  } catch {
    /* storage unavailable — cart must never break the UI */
  }
};

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.qty, 0);

export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.qty * line.price, 0);

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Mock prepaid order id, e.g. MW-ORD-48219. */
export const newOrderId = () =>
  `MW-ORD-${String(Math.floor(10000 + Math.random() * 89999))}`;
