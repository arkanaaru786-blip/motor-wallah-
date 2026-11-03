/**
 * Contact details shown across the site. These are the fallbacks; the live
 * values come from the `site_settings` table in Supabase and are swapped in by
 * applySiteSettings() once the cloud layer has loaded (see src/lib/site-settings.ts).
 * They stay `let` bindings so every existing import sees the updated value on
 * the next render without touching a single component.
 */
export let PHONE_DISPLAY = "1800 123 4567";
export let PHONE_HREF = "tel:18001234567";
export let WHATSAPP_BASE = "https://wa.me/919999999999";

/** Optional support inbox; empty unless the admin fills it in Settings. */
export let SUPPORT_EMAIL = "";

export function whatsappLink(message: string) {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export let WHATSAPP = whatsappLink("Hi Motor Wallah, I need help with a car");

/** Called once by the site-settings loader after the cloud values arrive. */
export function applySiteSettings(settings: {
  phoneDisplay?: string;
  phoneHref?: string;
  whatsappBase?: string;
  supportEmail?: string;
}) {
  if (settings.phoneDisplay) PHONE_DISPLAY = settings.phoneDisplay;
  if (settings.phoneHref) PHONE_HREF = settings.phoneHref;
  else if (settings.phoneDisplay) {
    const digits = settings.phoneDisplay.replace(/\D/g, "");
    if (digits) PHONE_HREF = `tel:${digits}`;
  }
  if (settings.whatsappBase) WHATSAPP_BASE = settings.whatsappBase;
  if (typeof settings.supportEmail === "string") SUPPORT_EMAIL = settings.supportEmail;
  WHATSAPP = whatsappLink("Hi Motor Wallah, I need help with a car");
}

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
