/**
 * Non-car vehicle categories. Each category owns its OWN Brand -> Model
 * catalogue and listings; a model may legitimately appear in more than one
 * category when the same vehicle is sold there too (e.g. Tata Ace is listed
 * under both SCV and Trucks). Cars live in vehicle-catalog.ts.
 */
export type CategoryId =
  "bikes" | "three-wheelers" | "scv" | "trucks" | "buses" | "tractors" | "taxi";

type Entry = [model: string, startYear: number, endYear: number];
const NOW = 2026;

export type CategoryDef = {
  id: CategoryId;
  title: string; // "Bikes"
  singular: string; // "Bike"
  to: string;
  blurb: string;
  fuels: string[];
  catalog: Record<string, Entry[]>;
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "bikes",
    title: "Bikes",
    singular: "Bike",
    to: "/buy/bikes",
    blurb: "Pre-owned motorcycles and scooters, checked and ready to ride.",
    fuels: ["Petrol", "Electric"],
    catalog: {
      Hero: [
        ["Splendor Plus", 2004, NOW],
        ["HF Deluxe", 2005, NOW],
        ["Passion Pro", 2009, NOW],
        ["Glamour", 2005, NOW],
        ["Xpulse 200", 2019, NOW],
        ["Karizma", 2003, 2019],
      ],
      Honda: [
        ["Activa", 2001, NOW],
        ["Shine", 2006, NOW],
        ["Unicorn", 2005, NOW],
        ["Dio", 2002, NOW],
        ["CB Hornet 160R", 2015, 2020],
      ],
      Bajaj: [
        ["Pulsar 150", 2001, NOW],
        ["Platina", 2006, NOW],
        ["Avenger", 2005, NOW],
        ["Dominar 400", 2016, NOW],
        ["Chetak", 2020, NOW],
        ["Discover", 2004, 2020],
      ],
      TVS: [
        ["Apache RTR 160", 2007, NOW],
        ["Jupiter", 2013, NOW],
        ["Ntorq 125", 2018, NOW],
        ["Star City", 2005, NOW],
        ["XL100", 2015, NOW],
      ],
      "Royal Enfield": [
        ["Classic 350", 2009, NOW],
        ["Bullet 350", 2000, NOW],
        ["Himalayan", 2016, NOW],
        ["Meteor 350", 2020, NOW],
        ["Thunderbird 350", 2002, 2020],
      ],
      Yamaha: [
        ["FZ", 2008, NOW],
        ["R15", 2008, NOW],
        ["Fascino", 2015, NOW],
        ["RX 100", 1985, 2003],
      ],
      Suzuki: [
        ["Access 125", 2007, NOW],
        ["Gixxer", 2014, NOW],
      ],
      "Ola Electric": [
        ["S1 Pro", 2021, NOW],
        ["S1 Air", 2023, NOW],
      ],
    },
  },
  {
    id: "three-wheelers",
    title: "3-Wheelers",
    singular: "3-Wheeler",
    to: "/buy/three-wheelers",
    blurb: "Passenger and cargo auto-rickshaws for daily earning.",
    fuels: ["Petrol", "Diesel", "CNG", "LPG", "Electric"],
    catalog: {
      Bajaj: [
        ["RE Compact", 2000, NOW],
        ["Maxima", 2012, NOW],
        ["Maxima Cargo", 2013, NOW],
      ],
      Piaggio: [
        ["Ape City", 2000, NOW],
        ["Ape Xtra LDX", 2010, NOW],
        ["Ape E-City", 2019, NOW],
      ],
      "Mahindra (3W)": [
        ["Alfa", 2005, NOW],
        ["Treo", 2018, NOW],
      ],
      "TVS (3W)": [["King", 2008, NOW]],
      Atul: [
        ["Gem", 2014, NOW],
        ["Shakti", 2006, NOW],
      ],
      // Local e-rickshaw brands requested for the 3-wheeler marketplace.
      "Khalsa EV": [
        ["E-Rickshaw Deluxe", 2020, NOW],
        ["E-Rickshaw Passenger", 2021, NOW],
      ],
      "All Fine EV": [
        ["E-Rickshaw Gold", 2020, NOW],
        ["E-Rickshaw Cargo", 2022, NOW],
      ],
    },
  },
  {
    id: "scv",
    title: "SCV",
    singular: "Small Commercial Vehicle",
    to: "/buy/scv",
    blurb: "Mini trucks and pickups for local goods transport.",
    fuels: ["Petrol", "Diesel", "CNG", "Electric"],
    catalog: {
      "Tata (SCV)": [
        ["Ace", 2005, NOW],
        ["Ace Gold", 2014, NOW],
        ["Intra V30", 2019, NOW],
        ["Yodha", 2018, NOW],
        ["Magic", 2007, NOW],
      ],
      "Mahindra (SCV)": [
        ["Bolero Pickup", 2007, NOW],
        ["Jeeto", 2015, NOW],
        ["Supro", 2015, NOW],
        ["Maxx Pik-Up", 2008, 2018],
      ],
      "Maruti Suzuki (SCV)": [["Super Carry", 2016, NOW]],
      "Ashok Leyland (SCV)": [
        ["Dost", 2011, NOW],
        ["Bada Dost", 2022, NOW],
      ],
      "Piaggio (SCV)": [["Porter 700", 2010, 2020]],
    },
  },
  {
    id: "trucks",
    title: "Trucks",
    singular: "Truck",
    to: "/buy/trucks",
    blurb: "Light, medium and heavy trucks for long-haul and fleet use.",
    fuels: ["Diesel", "CNG"],
    catalog: {
      "Tata Motors": [
        ["Ace", 2005, NOW],
        ["407", 1986, NOW],
        ["LPT 1109", 2005, NOW],
        ["Signa 4825", 2016, NOW],
        ["Prima 5530", 2009, NOW],
        ["Ultra 1918", 2014, NOW],
      ],
      "Ashok Leyland": [
        ["Dost", 2011, NOW],
        ["Ecomet 1615", 2011, NOW],
        ["Boss 1115", 2013, NOW],
        ["2820 Tipper", 2010, NOW],
        ["Captain", 2010, NOW],
      ],
      "Eicher Trucks": [
        ["Pro 2049", 2017, NOW],
        ["Pro 3015", 2014, NOW],
        ["11.10", 2000, 2016],
      ],
      BharatBenz: [
        ["1617R", 2012, NOW],
        ["2823R", 2012, NOW],
        ["3528C", 2014, NOW],
      ],
      "Mahindra Trucks": [
        ["Furio 7", 2019, NOW],
        ["Blazo X 28", 2015, NOW],
      ],
    },
  },
  {
    id: "buses",
    title: "Buses",
    singular: "Bus",
    to: "/buy/buses",
    blurb: "School, staff, tourist and route buses.",
    fuels: ["Diesel", "CNG", "Electric"],
    catalog: {
      "Tata Buses": [
        ["Starbus", 2005, NOW],
        ["Magna", 2010, NOW],
        ["Cityride", 2008, NOW],
        ["Winger", 2007, NOW],
      ],
      "Ashok Leyland Buses": [
        ["Viking", 1990, NOW],
        ["Lynx", 2007, NOW],
        ["Oyster", 2019, NOW],
      ],
      "Eicher Buses": [
        ["Skyline Pro", 2014, NOW],
        ["Starline", 2012, NOW],
      ],
      "Force Motors": [
        ["Traveller", 2004, NOW],
        ["Urbania", 2022, NOW],
      ],
      "BharatBenz Buses": [["Staff Bus 1017", 2015, NOW]],
    },
  },
  {
    id: "tractors",
    title: "Tractors",
    singular: "Tractor",
    to: "/buy/tractors",
    blurb: "Field-ready tractors for farming and haulage.",
    fuels: ["Diesel"],
    catalog: {
      Mahindra: [
        ["275 DI", 2000, NOW],
        ["575 DI", 2000, NOW],
        ["Arjun 555", 2006, NOW],
        ["Yuvo 575", 2016, NOW],
      ],
      Swaraj: [
        ["744 FE", 2000, NOW],
        ["855 FE", 2000, NOW],
        ["735 FE", 2000, NOW],
      ],
      Sonalika: [
        ["DI 745", 2005, NOW],
        ["Tiger 50", 2016, NOW],
      ],
      "John Deere": [
        ["5050D", 2005, NOW],
        ["5310", 2008, NOW],
      ],
      "Massey Ferguson": [
        ["241 DI", 2000, NOW],
        ["1035 DI", 2000, NOW],
      ],
      "New Holland": [["3630 TX", 2009, NOW]],
      Eicher: [["380", 2005, NOW]],
    },
  },
  {
    id: "taxi",
    title: "Taxi",
    singular: "Taxi",
    to: "/buy/taxi",
    blurb: "Commercial-registered (yellow plate) cars for taxi and fleet operators.",
    fuels: ["Petrol", "Diesel", "CNG", "Electric"],
    catalog: {
      "Maruti Suzuki (Taxi)": [
        ["Dzire Tour S", 2015, NOW],
        ["Ertiga Tour M", 2019, NOW],
        ["Wagon R Tour", 2019, NOW],
        ["Eeco Tour", 2018, NOW],
      ],
      "Hyundai (Taxi)": [
        ["Aura Prime T", 2023, NOW],
        ["Xcent Prime", 2018, 2023],
      ],
      "Toyota (Taxi)": [
        ["Innova Crysta (Commercial)", 2016, NOW],
        ["Etios (Commercial)", 2013, 2020],
      ],
      "Tata (Taxi)": [
        ["Xpres-T EV", 2021, NOW],
        ["Indica (Commercial)", 2000, 2018],
      ],
    },
  },
];

export const getCategory = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

const inYear = (e: Entry, y?: number) => !y || (y >= e[1] && y <= e[2]);

export const categoryBrands = (c: CategoryDef, year?: string) => {
  const y = year ? Number(year) : undefined;
  return Object.keys(c.catalog).filter((b) => c.catalog[b]!.some((e) => inYear(e, y)));
};

export const categoryModels = (c: CategoryDef, brand?: string, year?: string) => {
  const y = year ? Number(year) : undefined;
  const brands = brand ? [brand] : Object.keys(c.catalog);
  const list = brands.flatMap((b) =>
    (c.catalog[b] ?? []).filter((e) => inYear(e, y)).map((e) => e[0]),
  );
  return brand ? list : Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
};

export type CategoryListing = {
  id: string;
  category: CategoryId;
  brand: string;
  model: string;
  year: number;
  price: number; // ₹ lakh
  kilometres: number;
  fuel: string;
  location: string;
  ownership: string;
};

const LOCS = ["Indore", "Bhopal", "Ujjain", "Dewas"];

/**
 * Demo fuel assignment. Electric-only models must never be shown with a
 * combustion fuel (or the other way round), because the BUY page derives its
 * model-specific fuel options from these records.
 */
const ELECTRIC_MODEL = /(\be-?city|treo|chetak|rickshaw|\bs1\b|s1 pro|s1 air|xpres|electric|\bev\b)/i;

const fuelFor = (categoryId: CategoryId, model: string, index: number): string => {
  if (ELECTRIC_MODEL.test(model)) return "Electric";
  switch (categoryId) {
    case "bikes":
      return "Petrol";
    case "trucks":
    case "buses":
    case "tractors":
      return "Diesel";
    case "scv":
      return index % 4 === 3 ? "CNG" : "Diesel";
    case "taxi":
      return (["Diesel", "CNG", "Petrol"] as const)[index % 3]!;
    case "three-wheelers":
      return (["CNG", "Petrol", "Diesel"] as const)[index % 3]!;
    default:
      return "Petrol";
  }
};
const OWN = ["First Owner", "Second Owner"];
const BASE_PRICE: Record<CategoryId, number> = {
  bikes: 0.6,
  "three-wheelers": 1.6,
  scv: 3.8,
  trucks: 14,
  buses: 11,
  tractors: 4.5,
  taxi: 5.2,
};

/** Deterministic demo listings — 6 per category, always valid Brand -> Model pairs. */
export const CATEGORY_LISTINGS: CategoryListing[] = CATEGORIES.flatMap((c) => {
  const pairs = Object.entries(c.catalog).flatMap(([b, es]) => es.map((e) => ({ b, e })));
  return Array.from({ length: 6 }, (_, i) => {
    const { b, e } = pairs[(i * 5) % pairs.length]!;
    const year = Math.max(e[1], Math.min(e[2], 2024 - i));
    return {
      id: `${c.id}-${i + 1}`,
      category: c.id,
      brand: b,
      model: e[0],
      year,
      price: Math.round(BASE_PRICE[c.id] * (1 + ((i * 37) % 60) / 100) * 100) / 100,
      kilometres: (c.id === "bikes" ? 4000 : 18000) * (i + 1),
      fuel: fuelFor(c.id, e[0], i),
      location: LOCS[i % LOCS.length]!,
      ownership: OWN[i % 2]!,
    };
  });
});

export const listingsFor = (id: CategoryId) => CATEGORY_LISTINGS.filter((l) => l.category === id);
