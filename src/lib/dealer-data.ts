/**
 * Dealer portal data: this dealer's vehicles, leads and offers.
 *
 * Every read here takes the dealer and filters on BOTH `dealerId` and the
 * dealer's category. That is the hard boundary the product asks for — a Cars
 * dealer cannot see a Bike listing even by hand-crafting a URL or editing local
 * storage, because a row with a different category is never returned.
 *
 * Writes run through `ownRow`, so a dealer can only edit or delete a vehicle
 * they own and that belongs to their category.
 */
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import {
  dealerModels,
  dealerBrands,
  getDealerCategory,
  isValidDealerVehicle,
  type DealerCategoryId,
} from "@/lib/dealer-categories";
export type DealerScope = { dealerId: string; category: DealerCategoryId };

const KEY = "mw_dealer_portal_v1";

export const VEHICLE_STATUSES = ["Pending", "Active", "Sold"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const OFFER_STATUSES = ["Pending", "Accepted", "Rejected", "Counter Offer"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export type DealerVehicle = {
  id: string;
  dealerId: string;
  category: DealerCategoryId;
  brand: string;
  model: string;
  name: string;
  year: number;
  /** Asking price in whole rupees. */
  price: number;
  km: number;
  fuel: string;
  views: number;
  leads: number;
  status: VehicleStatus;
  createdAt: string;
};

export type DealerLead = {
  id: string;
  dealerId: string;
  category: DealerCategoryId;
  customer: string;
  mobile: string;
  vehicleName: string;
  location: string;
  /** ISO timestamp the enquiry arrived. */
  date: string;
  source: "Enquiry" | "Call" | "Chat" | "Test drive";
  status: "New" | "Contacted" | "Closed";
};

export type DealerOffer = {
  id: string;
  dealerId: string;
  category: DealerCategoryId;
  customer: string;
  mobile: string;
  vehicleName: string;
  /** Customer's offer, whole rupees. */
  amount: number;
  /** Dealer's asking price when the offer arrived, whole rupees. */
  askingPrice: number;
  message: string;
  status: OfferStatus;
  /** Dealer's counter figure, set when they "Send counter offer". */
  counterAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

type Database = {
  vehicles: DealerVehicle[];
  leads: DealerLead[];
  offers: DealerOffer[];
};

const EMPTY: Database = { vehicles: [], leads: [], offers: [] };

function read(): Database {
  const raw = replicaRead<unknown>(KEY, null);
  if (!raw || typeof raw !== "object") return { vehicles: [], leads: [], offers: [] };
  const data = raw as Partial<Database>;
  return {
    vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
    leads: Array.isArray(data.leads) ? data.leads : [],
    offers: Array.isArray(data.offers) ? data.offers : [],
  };
}

function write(next: Database): boolean {
  return replicaWrite(KEY, next);
}

/* ---------------------------------------------------------------- seeding */

const LEAD_NAMES = ["Rohit Sharma", "Ayesha Khan", "Vikram Nair", "Pooja Deshmukh", "Sahil Gupta"];
const LEAD_CITIES = ["Mumbai", "Pune", "Thane", "Navi Mumbai", "Nashik"];
const OFFER_MESSAGES = [
  "Can you do a better price? Ready to buy this week.",
  "Interested, but the price is a little high for me.",
  "I will pay cash today if you can adjust.",
];

const FUELS: Record<string, string[]> = {
  cars: ["Petrol", "Diesel", "CNG"],
  bikes: ["Petrol"],
  "three-wheelers": ["Petrol", "CNG"],
  scv: ["Diesel", "CNG"],
  trucks: ["Diesel"],
  buses: ["Diesel", "CNG"],
  tractors: ["Diesel"],
  taxi: ["Petrol", "CNG"],
};

const PRICE_BANDS: Record<string, [number, number]> = {
  cars: [320000, 1450000],
  bikes: [38000, 195000],
  "three-wheelers": [145000, 320000],
  scv: [420000, 780000],
  trucks: [850000, 2400000],
  buses: [950000, 3200000],
  tractors: [280000, 850000],
  taxi: [240000, 620000],
};

/** A dealer opening the portal for the first time gets a small, realistic book. */
export function seedDealerData(dealer: DealerScope): void {
  const data = read();
  if (data.vehicles.some((vehicle) => vehicle.dealerId === dealer.dealerId)) return;

  const category = dealer.category;
  const bands = PRICE_BANDS[category] ?? [300000, 900000];
  const fuels = FUELS[category] ?? ["Petrol"];
  const brands = dealerBrands(category).slice(0, 4);
  const now = Date.now();
  const stamp = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();

  const vehicles: DealerVehicle[] = [];
  brands.forEach((brand, index) => {
    const models = dealerModels(category, brand);
    const model = models[index % Math.max(1, models.length)] ?? "Base";
    const price = Math.round(bands[0] + ((bands[1] - bands[0]) * ((index * 37) % 100)) / 100);
    vehicles.push({
      id: `${dealer.dealerId}-V${index + 1}`,
      dealerId: dealer.dealerId,
      category,
      brand,
      model,
      name: `${brand} ${model}`,
      year: 2023 - (index % 4),
      price,
      km: 12000 + index * 7300,
      fuel: fuels[index % fuels.length]!,
      views: 48 + index * 37 + (dealer.dealerId.charCodeAt(dealer.dealerId.length - 1) % 20),
      leads: 2 + ((index * 3) % 7),
      status: index === 0 ? "Active" : index === 1 ? "Pending" : index === 2 ? "Active" : "Sold",
      createdAt: stamp(18 - index * 3),
    });
  });

  const leads: DealerLead[] = vehicles.slice(0, 4).map((vehicle, index) => ({
    id: `${dealer.dealerId}-L${index + 1}`,
    dealerId: dealer.dealerId,
    category,
    customer: LEAD_NAMES[index % LEAD_NAMES.length]!,
    mobile: `98${String(20011200 + index * 7 + dealer.dealerId.length).slice(-8)}`,
    vehicleName: vehicle.name,
    location: LEAD_CITIES[index % LEAD_CITIES.length]!,
    date: stamp(index * 1.5),
    source: (["Enquiry", "Call", "Chat", "Test drive"] as const)[index % 4]!,
    status: index === 0 ? "New" : index === 1 ? "New" : index === 2 ? "Contacted" : "Closed",
  }));

  const offers: DealerOffer[] = vehicles.slice(0, 3).map((vehicle, index) => {
    return {
      id: `${dealer.dealerId}-O${index + 1}`,
      dealerId: dealer.dealerId,
      category,
      customer: LEAD_NAMES[(index + 2) % LEAD_NAMES.length]!,
      mobile: `97${String(30041500 + index * 9 + dealer.dealerId.length).slice(-8)}`,
      vehicleName: vehicle.name,
      amount: Math.round(vehicle.price * (0.86 + index * 0.03)),
      askingPrice: vehicle.price,
      message: OFFER_MESSAGES[index % OFFER_MESSAGES.length]!,
      status: "Pending",
      counterAmount: null,
      createdAt: stamp(index * 2 + 1),
      updatedAt: stamp(index * 2 + 1),
    };
  });

  write({
    ...data,
    vehicles: [...data.vehicles, ...vehicles],
    leads: [...data.leads, ...leads],
    offers: [...data.offers, ...offers],
  });
}

/* ------------------------------------------------------------------ reads */

export type DealerBook = {
  category: DealerCategoryId;
  vehicles: DealerVehicle[];
  leads: DealerLead[];
  offers: DealerOffer[];
};

/** Everything this dealer is allowed to see, category-locked. */
export function dealerBook(dealer: DealerScope): DealerBook {
  const data = read();
  const owned = (row: { dealerId: string; category: DealerCategoryId }) =>
    row.dealerId === dealer.dealerId && row.category === dealer.category;
  return {
    category: dealer.category,
    vehicles: data.vehicles.filter(owned).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    leads: data.leads.filter(owned).sort((a, b) => (a.date < b.date ? 1 : -1)),
    offers: data.offers.filter(owned).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  };
}

export type DealerKpis = {
  listed: number;
  active: number;
  views: number;
  leads: number;
  offers: number;
  inventoryValue: number;
  categoryLabel: string;
};

export function dealerKpis(dealer: DealerScope, book: DealerBook): DealerKpis {
  const listed = book.vehicles.filter((vehicle) => vehicle.status !== "Sold");
  return {
    listed: listed.length,
    active: book.vehicles.filter((vehicle) => vehicle.status === "Active").length,
    views: book.vehicles.reduce((total, vehicle) => total + vehicle.views, 0),
    leads: book.leads.length,
    offers: book.offers.length,
    inventoryValue: listed.reduce((total, vehicle) => total + vehicle.price, 0),
    categoryLabel: getDealerCategory(dealer.category).label,
  };
}

/* ----------------------------------------------------------------- writes */

export type VehicleInput = {
  brand: string;
  model: string;
  year: number;
  price: number;
  km: number;
  fuel: string;
  status: VehicleStatus;
};

export type WriteResult<T> = { ok: true; value: T } | { ok: false; error: string };

function ownVehicle(dealer: DealerScope, id: string): DealerVehicle | null {
  const data = read();
  const vehicle = data.vehicles.find((item) => item.id === id);
  if (!vehicle) return null;
  if (vehicle.dealerId !== dealer.dealerId) return null;
  if (vehicle.category !== dealer.category) return null;
  return vehicle;
}

export function addVehicle(dealer: DealerScope, input: VehicleInput): WriteResult<DealerVehicle> {
  const category = dealer.category;
  if (!dealerBrands(category).includes(input.brand)) {
    return { ok: false, error: "That brand does not belong to your category." };
  }
  if (!isValidDealerVehicle(category, input.brand, input.model)) {
    return { ok: false, error: "That model does not belong to your category." };
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: "Enter an asking price greater than zero." };
  }
  if (!Number.isFinite(input.year) || input.year < 1990 || input.year > 2026) {
    return { ok: false, error: "Enter a year between 1990 and 2026." };
  }
  if (!Number.isFinite(input.km) || input.km < 0) {
    return { ok: false, error: "Enter the kilometres driven." };
  }
  if (!VEHICLE_STATUSES.includes(input.status)) {
    return { ok: false, error: "Choose a listing status." };
  }

  const data = read();
  const vehicle: DealerVehicle = {
    id: `${dealer.dealerId}-${Date.now().toString(36)}`,
    dealerId: dealer.dealerId,
    category,
    brand: input.brand,
    model: input.model,
    name: `${input.brand} ${input.model}`,
    year: Math.round(input.year),
    price: Math.round(input.price),
    km: Math.round(input.km),
    fuel: input.fuel,
    views: 0,
    leads: 0,
    status: input.status,
    createdAt: new Date().toISOString(),
  };
  if (!write({ ...data, vehicles: [...data.vehicles, vehicle] })) {
    return { ok: false, error: "Storage is blocked, so the listing was not saved." };
  }
  return { ok: true, value: vehicle };
}

export function updateVehicle(
  dealer: DealerScope,
  id: string,
  input: VehicleInput,
): WriteResult<DealerVehicle> {
  const current = ownVehicle(dealer, id);
  if (!current) return { ok: false, error: "That listing is not in your inventory." };
  if (!isValidDealerVehicle(dealer.category, input.brand, input.model)) {
    return { ok: false, error: "That model does not belong to your category." };
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: "Enter an asking price greater than zero." };
  }
  if (!VEHICLE_STATUSES.includes(input.status)) {
    return { ok: false, error: "Choose a listing status." };
  }

  const data = read();
  const next: DealerVehicle = {
    ...current,
    brand: input.brand,
    model: input.model,
    name: `${input.brand} ${input.model}`,
    year: Math.round(input.year),
    price: Math.round(input.price),
    km: Math.round(input.km),
    fuel: input.fuel,
    status: input.status,
  };
  if (!write({ ...data, vehicles: data.vehicles.map((item) => (item.id === id ? next : item)) })) {
    return { ok: false, error: "Storage is blocked, so the change was not saved." };
  }
  return { ok: true, value: next };
}

export function deleteVehicle(dealer: DealerScope, id: string): WriteResult<string> {
  const current = ownVehicle(dealer, id);
  if (!current) return { ok: false, error: "That listing is not in your inventory." };
  const data = read();
  if (!write({ ...data, vehicles: data.vehicles.filter((item) => item.id !== id) })) {
    return { ok: false, error: "Storage is blocked, so the listing was not deleted." };
  }
  return { ok: true, value: id };
}

export function setLeadStatus(
  dealer: DealerScope,
  id: string,
  status: DealerLead["status"],
): WriteResult<DealerLead> {
  const data = read();
  const lead = data.leads.find((item) => item.id === id);
  if (!lead || lead.dealerId !== dealer.dealerId || lead.category !== dealer.category) {
    return { ok: false, error: "That lead is not in your pipeline." };
  }
  const next: DealerLead = { ...lead, status };
  write({ ...data, leads: data.leads.map((item) => (item.id === id ? next : item)) });
  return { ok: true, value: next };
}

export type OfferAction = "accept" | "reject" | "counter";

/**
 * Accept, reject or counter a customer offer.
 *
 * Accepting does NOT change the listing price — it records the customer's offer
 * as accepted so both sides have the same number in writing.
 */
export function respondToOffer(
  dealer: DealerScope,
  id: string,
  action: OfferAction,
  counterAmount?: number,
): WriteResult<DealerOffer> {
  const data = read();
  const offer = data.offers.find((item) => item.id === id);
  if (!offer || offer.dealerId !== dealer.dealerId || offer.category !== dealer.category) {
    return { ok: false, error: "That offer is not in your pipeline." };
  }

  let status: OfferStatus;
  let counter: number | null = null;
  if (action === "accept") {
    status = "Accepted";
  } else if (action === "reject") {
    status = "Rejected";
  } else {
    if (!Number.isFinite(counterAmount ?? NaN) || (counterAmount ?? 0) <= 0) {
      return { ok: false, error: "Enter the counter amount in rupees." };
    }
    status = "Counter Offer";
    counter = Math.round(counterAmount!);
  }

  const next: DealerOffer = {
    ...offer,
    status,
    counterAmount: counter,
    updatedAt: new Date().toISOString(),
  };
  if (!write({ ...data, offers: data.offers.map((item) => (item.id === id ? next : item)) })) {
    return { ok: false, error: "Storage is blocked, so the offer was not updated." };
  }
  return { ok: true, value: next };
}

/** Clear a dealer's book — used only by the demo reset on the login page. */
export function resetDealerData(): void {
  write(EMPTY);
}
