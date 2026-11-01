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

export const BUY_CATEGORIES = [
  // `to` keeps the long-standing category URLs (they now redirect into the
  // unified BUY catalogue); `category` is used to deep-link it directly.
  { label: "Cars", category: "cars", to: "/cars", blurb: "Hatchbacks, sedans & SUVs" },
  { label: "Bikes", category: "bikes", to: "/buy/bikes", blurb: "Motorcycles & scooters" },
  {
    label: "3-Wheelers",
    category: "three-wheelers",
    to: "/buy/three-wheelers",
    blurb: "Autos & e-rickshaws",
  },
  {
    label: "SCV / Mini Trucks",
    category: "scv",
    to: "/buy/scv",
    blurb: "Mini trucks & pickups",
  },
  { label: "Trucks", category: "trucks", to: "/buy/trucks", blurb: "Light to heavy trucks" },
  { label: "Buses", category: "buses", to: "/buy/buses", blurb: "School, staff & tourist" },
  { label: "Tractors", category: "tractors", to: "/buy/tractors", blurb: "Farm tractors" },
  {
    label: "Taxi / Commercial Cars",
    category: "taxi",
    to: "/buy/taxi",
    blurb: "Yellow-plate commercial cars",
  },
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
