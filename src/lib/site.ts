export const PHONE_DISPLAY = "1800 123 4567";
export const PHONE_HREF = "tel:18001234567";
export const WHATSAPP_BASE = "https://wa.me/919999999999";

export function whatsappLink(message: string) {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP = whatsappLink("Hi Motor Wallah, I need help with a car");

export const MAIN_NAV = [
  { label: "Buy", to: "/buy" },
  { label: "Sell", to: "/sell-your-car" },
  { label: "Exchange", to: "/exchange" },
  { label: "Value", to: "/sell-your-car" },
  { label: "Compare", to: "/compare" },
  { label: "Service", to: "/services" },
  { label: "Scrap", to: "/scrap" },
  { label: "Decor", to: "/decor" },
  { label: "Franchise", to: "/franchise" },
] as const;

/**
 * The eight BUY categories. There is exactly ONE listing page — the unified
 * BUY catalogue — so a category is identified by its `category` slug and every
 * link builds `/buy?category=<slug>` from it. No category has its own route.
 */
export const BUY_CATEGORIES = [
  { label: "Cars", category: "cars", blurb: "Hatchbacks, sedans & SUVs" },
  { label: "Bikes", category: "bikes", blurb: "Motorcycles & scooters" },
  { label: "3-Wheelers", category: "three-wheelers", blurb: "Autos & e-rickshaws" },
  { label: "SCV / Mini Trucks", category: "scv", blurb: "Mini trucks & pickups" },
  { label: "Trucks", category: "trucks", blurb: "Light to heavy trucks" },
  { label: "Buses", category: "buses", blurb: "School, staff & tourist" },
  { label: "Tractors", category: "tractors", blurb: "Farm tractors" },
  { label: "Taxi / Commercial Cars", category: "taxi", blurb: "Yellow-plate commercial cars" },
] as const;

export const SERVICE_LINKS = [
  { label: "Inspection", to: "/inspection" },
  { label: "Insurance", to: "/insurance" },
  { label: "RTO", to: "/rto" },
  { label: "Workshop", to: "/workshop" },
  { label: "Warranty", to: "/warranty" },
  { label: "Roadside Assistance", to: "/roadside-assistance" },
  { label: "Accessories", to: "/accessories" },
] as const;
