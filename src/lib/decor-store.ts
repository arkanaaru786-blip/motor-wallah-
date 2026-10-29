/**
 * VEHICLE DECOR store — accessories that dress up a vehicle (interior,
 * exterior, lighting, audio, utility) plus the fitter network around them.
 *
 * Deterministic mock catalogue powering the /decor flow:
 * Vehicle Category → Decor Category → Product Grid → Contact Fitter / Cart.
 *
 * This is deliberately separate from Auto Parts (parts-store.ts): decor is a
 * styling/comfort storefront where installation matters, so every product can
 * be sent to a nearby fitter via the "Contact Fitter" lead. Auto Parts and
 * Second-Hand Parts pages never use this module, so the Contact Fitter button
 * cannot leak into them.
 *
 * Prices and stock are illustrative — the Motor Wallah team confirms the
 * final quote (and fitter charges) with the customer directly.
 */
import {
  Armchair,
  CarFront,
  Lightbulb,
  SprayCan,
  Speaker,
  type LucideIcon,
} from "lucide-react";

export type DecorCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /** Seller / brand names used in generated product names. */
  brands: string[];
  /** Catalogue item names, e.g. "Full Seat Cover Set". */
  items: string[];
  /** Illustrative price band, rupees. */
  min: number;
  max: number;
};

/** The five decor categories required by the Vehicle Decor brief. */
export const DECOR_CATEGORY_LIST: DecorCategory[] = [
  {
    id: "interior",
    label: "Interior Decor",
    icon: Armchair,
    blurb: "Seat covers, steering covers, mats, perfumes",
    brands: ["Vega", "Autofy", "Mobo", "3M", "WiZR"],
    items: [
      "Full Seat Cover Set",
      "Steering Wheel Cover",
      "7D Floor Mat Set",
      "Dashboard Perfume Can",
      "Steering Grip Wrap",
      "Organiser & Armrest Box",
    ],
    min: 349,
    max: 8999,
  },
  {
    id: "exterior",
    label: "Exterior Styling",
    icon: CarFront,
    blurb: "Body kits, spoilers, roof rails, wraps",
    brands: ["Stylo", "Zext", "OEM Fit", "Carbonx", "Steelcraft"],
    items: [
      "Front Body Kit Lip",
      "Boot Lid Spoiler",
      "Roof Rail Set",
      "Vinyl Wrap Roll 5x15m",
      "Window Visor Set",
      "Chrome Grille Kit",
    ],
    min: 899,
    max: 24999,
  },
  {
    id: "lighting",
    label: "Lighting & LEDs",
    icon: Lightbulb,
    blurb: "Headlights, ambient lights, DRLs",
    brands: ["Hella", "Osram", "Philips", "Uno Minda", "Nitek"],
    items: [
      "LED Headlight Pair",
      "Ambient Footwell Lights",
      "Door Handle LED Set",
      "DRL Strip Pair",
      "Interior Dome LED",
      "Underglow Strip",
    ],
    min: 449,
    max: 12999,
  },
  {
    id: "audio",
    label: "Audio & Infotainment",
    icon: Speaker,
    blurb: "Speakers, Android Auto systems",
    brands: ["Blaupunkt", "JBL", "Pioneer", "Sony", "Kenwood"],
    items: [
      'Component Speaker Set 6.5"',
      "Android Auto Touchscreen Head Unit",
      "Coaxial Speakers Pair",
      "Subwoofer 10-inch",
      "Tweeter Set",
      "Amplifier 4-Channel",
    ],
    min: 1299,
    max: 34999,
  },
  {
    id: "utility",
    label: "Utility & Care",
    icon: SprayCan,
    blurb: "Phone holders, vacuum, polish",
    brands: ["3M", "WiZR", "AutoEngineme", "Bosch", "Armor All"],
    items: [
      "Vacuum Cleaner 12V",
      "Mobile Phone Holder",
      "Microfiber Polish Kit",
      "Tyre Shine & Gel",
      "Seat Gap Organiser",
      "Wash Mitt & Shampoo Kit",
    ],
    min: 249,
    max: 5999,
  },
];

export const getDecorCategory = (id: string | undefined | null) =>
  DECOR_CATEGORY_LIST.find((c) => c.id === id);

export type DecorProduct = {
  id: string;
  name: string;
  /** Brand of the product. */
  brand: string;
  /** Seller / store fulfilling the order. */
  seller: string;
  price: number;
  mrp: number;
  discount: number;
  rating: number;
  reviews: number;
  /** Days until delivery, shown as an arrival date. */
  etaDays: number;
  /** Installation-friendly items can be fitted by a Motor Wallah fitter. */
  installation: "Fitter available" | "DIY";
};

/**
 * Deterministic hash so the same selection always shows the same shelf.
 * The plain djb2 value only steps by ~33 per product index, which would put
 * every price in a category on a near-identical ladder — so it finishes with
 * an avalanche mix to spread prices and ratings across the whole band.
 */
const hash = (seed: string) => {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
};

const SELLERS = [
  "Motor Wallah Decor Studio",
  "AutoMart Accessories",
  "WheelWise Decor",
  "Metro Auto Accessories",
];

/**
 * Generates the product shelf for a decor category (optionally scoped to the
 * chosen vehicle category, so shelves differ per vehicle but stay stable).
 */
export function buildDecorProducts(categoryId: string, vehicleId: string): DecorProduct[] {
  const category = getDecorCategory(categoryId);
  if (!category) return [];

  const count = 10;
  const products: DecorProduct[] = [];
  for (let i = 0; i < count; i += 1) {
    const brand = category.brands[i % category.brands.length]!;
    const item = category.items[i % category.items.length]!;
    const seed = hash(`${categoryId}|${vehicleId}|${i}`);
    const span = category.max - category.min;
    const price = Math.round((category.min + (span * (seed % 1000)) / 1000) / 10) * 10 - 1;
    const discount = 5 + (seed % 41); // 5% – 45%
    const mrp = Math.round(price / (1 - discount / 100) / 10) * 10;

    products.push({
      id: `${categoryId}-${i}`,
      name: `${brand} ${item}`,
      brand,
      seller: SELLERS[seed % SELLERS.length]!,
      price,
      mrp,
      discount,
      rating: Math.round((3.7 + ((seed >> 3) % 13) / 10) * 10) / 10,
      reviews: 30 + (seed % 2400),
      etaDays: 2 + ((seed >> 5) % 6),
      installation: seed % 5 === 0 ? "DIY" : "Fitter available",
    });
  }
  // Cheapest first, like a storefront default sort.
  return products.sort((a, b) => a.price - b.price);
}

/* -------------------------------------------------------------------------- */
/* Cart — persisted per device so the drawer survives step navigation.        */
/* -------------------------------------------------------------------------- */
export type DecorCartLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  categoryLabel: string;
};

const CART_KEY = "mw_decor_cart";

export const readDecorCart = (): DecorCartLine[] => {
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as DecorCartLine[];
  } catch {
    return [];
  }
};

export const writeDecorCart = (lines: DecorCartLine[]): void => {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(lines.slice(0, 30)));
  } catch {
    /* storage unavailable — cart must never break the UI */
  }
};

export const cartCount = (lines: DecorCartLine[]) =>
  lines.reduce((sum, line) => sum + line.qty, 0);

export const cartTotal = (lines: DecorCartLine[]) =>
  lines.reduce((sum, line) => sum + line.qty * line.price, 0);

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Mock decor order id, e.g. MW-DCR-48219. */
export const newDecorOrderId = () =>
  `MW-DCR-${String(Math.floor(10000 + Math.random() * 89999))}`;
