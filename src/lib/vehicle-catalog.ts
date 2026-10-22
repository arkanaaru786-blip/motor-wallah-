/**
 * Central Motor Wallah vehicle catalogue — Indian USED-CAR market.
 *
 * Single source of truth for the Brand -> Model -> Year relationship used by
 * the inventory listing, home search, vehicle metadata and any future admin
 * inventory entry form. Never duplicate model names elsewhere.
 *
 * Because Motor Wallah is a certified PRE-OWNED business, the dataset covers
 * current models, older generations, discontinued models and brands that no
 * longer sell new cars in India (Ford, Chevrolet, Datsun, Fiat, Mitsubishi,
 * Premier, Opel, Hindustan Motors, Daewoo...).
 *
 * Shape mirrors a future relational backend and is intentionally extensible
 * (generation / variant / bodyType / fuel / seating can be added per entry):
 *   brand(brand_id, brand_name)
 *   model(model_id, brand_id, model_name, start_year, end_year, ...)
 *   vehicle_listing(listing_id, brand_id, model_id, year, ...)
 */

export type Brand = { id: string; name: string };

export type Model = {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  startYear: number;
  /** Last year available in India. Ongoing models use CURRENT_YEAR. */
  endYear: number;
  /** Optional future-proof attributes (unused today, safe to populate later). */
  generation?: string;
  bodyType?: string;
  fuelTypes?: string[];
  transmissions?: string[];
  seating?: number;
};

export const CURRENT_YEAR = 2026;
/** Oldest year exposed in the Year filter. Data may go older; the filter can grow. */
export const OLDEST_FILTER_YEAR = 2000;

type Entry = [model: string, startYear: number, endYear: number];

const NOW = CURRENT_YEAR;

const catalog: Record<string, Entry[]> = {
  "Maruti Suzuki": [
    ["800", 1983, 2014],
    ["Omni", 1984, 2019],
    ["Gypsy", 1985, 2019],
    ["Zen", 1993, 2006],
    ["Esteem", 1994, 2008],
    ["Baleno (Old)", 1999, 2007],
    ["Wagon R", 1999, NOW],
    ["Alto", 2000, 2020],
    ["Versa", 2001, 2010],
    ["Swift", 2005, NOW],
    ["Zen Estilo", 2006, 2013],
    ["SX4", 2007, 2014],
    ["Dzire", 2008, NOW],
    ["A-Star", 2008, 2014],
    ["Ritz", 2009, 2016],
    ["Eeco", 2010, NOW],
    ["Alto K10", 2010, NOW],
    ["Kizashi", 2011, 2014],
    ["Ertiga", 2012, NOW],
    ["Stingray", 2013, 2017],
    ["Celerio", 2014, NOW],
    ["Ciaz", 2014, 2025],
    ["S-Cross", 2015, 2022],
    ["Baleno", 2015, NOW],
    ["Vitara Brezza", 2016, 2022],
    ["Ignis", 2017, NOW],
    ["XL6", 2019, NOW],
    ["S-Presso", 2019, NOW],
    ["Brezza", 2022, NOW],
    ["Grand Vitara", 2022, NOW],
    ["Jimny", 2023, NOW],
    ["Fronx", 2023, NOW],
    ["Invicto", 2023, NOW],
    ["e Vitara", 2025, NOW],
  ],
  Hyundai: [
    ["Santro", 1998, 2003],
    ["Accent", 1999, 2013],
    ["Sonata", 2001, 2014],
    ["Santro Xing", 2003, 2014],
    ["Getz", 2004, 2010],
    ["Terracan", 2003, 2007],
    ["Tucson", 2005, NOW],
    ["Verna", 2006, NOW],
    ["i10", 2007, 2017],
    ["i20", 2008, NOW],
    ["Santa Fe", 2010, 2018],
    ["Eon", 2011, 2019],
    ["Elantra", 2012, 2022],
    ["Grand i10", 2013, 2020],
    ["Xcent", 2014, 2019],
    ["Creta", 2015, NOW],
    ["Elite i20", 2014, 2020],
    ["Grand i10 Nios", 2019, NOW],
    ["Venue", 2019, NOW],
    ["Aura", 2020, NOW],
    ["Kona Electric", 2019, 2023],
    ["Alcazar", 2021, NOW],
    ["i20 N Line", 2021, NOW],
    ["Venue N Line", 2022, NOW],
    ["Tucson (New)", 2022, NOW],
    ["Ioniq 5", 2023, NOW],
    ["Exter", 2023, NOW],
    ["Creta N Line", 2024, NOW],
    ["Creta Electric", 2025, NOW],
  ],
  Tata: [
    ["Sierra (Classic)", 1991, 2000],
    ["Sumo", 1994, 2019],
    ["Safari", 1998, 2019],
    ["Indica", 1998, 2018],
    ["Indigo", 2002, 2018],
    ["Indigo Marina", 2004, 2009],
    ["Indica Vista", 2008, 2015],
    ["Indigo Manza", 2009, 2016],
    ["Aria", 2010, 2016],
    ["Venture", 2010, 2016],
    ["Nano", 2009, 2018],
    ["Sumo Grande", 2008, 2016],
    ["Movus", 2014, 2016],
    ["Zest", 2014, 2020],
    ["Bolt", 2015, 2019],
    ["Tiago", 2016, NOW],
    ["Hexa", 2017, 2020],
    ["Tigor", 2017, NOW],
    ["Nexon", 2017, NOW],
    ["Harrier", 2019, NOW],
    ["Altroz", 2020, NOW],
    ["Nexon EV", 2020, NOW],
    ["Safari (New)", 2021, NOW],
    ["Punch", 2021, NOW],
    ["Tiago EV", 2022, NOW],
    ["Curvv", 2024, NOW],
    ["Sierra", 2025, NOW],
  ],
  Mahindra: [
    ["Bolero", 2000, NOW],
    ["Scorpio", 2002, 2022],
    ["Xylo", 2009, 2019],
    ["Thar", 2010, NOW],
    ["XUV500", 2011, 2021],
    ["Quanto", 2012, 2016],
    ["Verito", 2011, 2018],
    ["Verito Vibe", 2013, 2017],
    ["e2o", 2013, 2019],
    ["KUV100", 2016, 2023],
    ["TUV300", 2015, 2021],
    ["NuvoSport", 2016, 2019],
    ["Marazzo", 2018, NOW],
    ["Alturas G4", 2018, 2022],
    ["XUV300", 2019, 2024],
    ["Bolero Neo", 2021, NOW],
    ["Scorpio Classic", 2022, NOW],
    ["Scorpio-N", 2022, NOW],
    ["XUV700", 2021, NOW],
    ["XUV 3XO", 2024, NOW],
    ["Thar Roxx", 2024, NOW],
    ["BE 6", 2025, NOW],
    ["XEV 9e", 2025, NOW],
    ["XUV 7XO", 2025, NOW],
  ],
  Toyota: [
    ["Qualis", 2000, 2005],
    ["Corolla", 2003, 2009],
    ["Innova", 2005, 2016],
    ["Camry", 2002, NOW],
    ["Fortuner", 2009, NOW],
    ["Corolla Altis", 2008, 2020],
    ["Etios", 2010, 2020],
    ["Etios Liva", 2011, 2020],
    ["Etios Cross", 2014, 2019],
    ["Land Cruiser", 2003, NOW],
    ["Land Cruiser Prado", 2004, 2020],
    ["Yaris", 2018, 2021],
    ["Glanza", 2019, NOW],
    ["Innova Crysta", 2016, NOW],
    ["Urban Cruiser", 2020, 2022],
    ["Vellfire", 2020, NOW],
    ["Hilux", 2022, NOW],
    ["Urban Cruiser Hyryder", 2022, NOW],
    ["Innova Hycross", 2023, NOW],
    ["Rumion", 2023, NOW],
    ["Taisor", 2024, NOW],
  ],
  Honda: [
    ["City", 1998, NOW],
    ["Accord", 2001, 2016],
    ["Civic", 2006, 2020],
    ["CR-V", 2003, 2020],
    ["Jazz", 2009, 2022],
    ["Brio", 2011, 2018],
    ["Amaze", 2013, NOW],
    ["Mobilio", 2014, 2017],
    ["BR-V", 2016, 2020],
    ["WR-V", 2017, 2023],
    ["City e:HEV", 2022, NOW],
    ["Elevate", 2023, NOW],
  ],
  Ford: [
    ["Ikon", 1999, 2011],
    ["Mondeo", 2001, 2007],
    ["Endeavour", 2003, 2021],
    ["Fusion", 2004, 2010],
    ["Fiesta", 2005, 2015],
    ["Figo", 2010, 2021],
    ["Classic", 2011, 2015],
    ["EcoSport", 2013, 2021],
    ["Aspire", 2015, 2021],
    ["Mustang", 2016, 2020],
    ["Freestyle", 2018, 2021],
  ],
  Chevrolet: [
    ["Corsa", 2003, 2006],
    ["Optra", 2003, 2012],
    ["Tavera", 2004, 2017],
    ["Aveo", 2006, 2012],
    ["Spark", 2007, 2015],
    ["Captiva", 2008, 2015],
    ["Cruze", 2009, 2017],
    ["Beat", 2010, 2017],
    ["Sail", 2013, 2017],
    ["Sail U-VA", 2012, 2017],
    ["Enjoy", 2013, 2017],
    ["Trailblazer", 2015, 2017],
  ],
  Volkswagen: [
    ["Passat", 2007, 2018],
    ["Jetta", 2008, 2017],
    ["Polo", 2010, 2022],
    ["Vento", 2010, 2022],
    ["Beetle", 2003, 2019],
    ["Ameo", 2016, 2020],
    ["Tiguan", 2017, NOW],
    ["T-Roc", 2020, 2022],
    ["Taigun", 2021, NOW],
    ["Virtus", 2022, NOW],
  ],
  Skoda: [
    ["Octavia", 2001, NOW],
    ["Superb", 2004, NOW],
    ["Laura", 2005, 2013],
    ["Fabia", 2008, 2013],
    ["Yeti", 2010, 2018],
    ["Rapid", 2011, 2022],
    ["Kodiaq", 2017, NOW],
    ["Karoq", 2020, 2022],
    ["Kushaq", 2021, NOW],
    ["Slavia", 2022, NOW],
    ["Kylaq", 2024, NOW],
  ],
  Renault: [
    ["Logan", 2007, 2011],
    ["Fluence", 2011, 2015],
    ["Koleos", 2011, 2015],
    ["Pulse", 2012, 2017],
    ["Duster", 2012, 2022],
    ["Scala", 2012, 2017],
    ["Lodgy", 2015, 2020],
    ["Kwid", 2015, NOW],
    ["Captur", 2017, 2020],
    ["Triber", 2019, NOW],
    ["Kiger", 2021, NOW],
  ],
  Nissan: [
    ["X-Trail", 2005, NOW],
    ["Teana", 2007, 2013],
    ["Micra", 2010, 2020],
    ["Sunny", 2011, 2019],
    ["Evalia", 2012, 2016],
    ["Terrano", 2013, 2020],
    ["GT-R", 2016, 2019],
    ["Kicks", 2019, 2022],
    ["Magnite", 2020, NOW],
    ["Gravite", 2025, NOW],
  ],
  Kia: [
    ["Seltos", 2019, NOW],
    ["Carnival", 2019, NOW],
    ["Sonet", 2020, NOW],
    ["Carens", 2022, NOW],
    ["EV6", 2022, NOW],
    ["EV9", 2024, NOW],
    ["Syros", 2025, NOW],
    ["Carens Clavis", 2025, NOW],
  ],
  MG: [
    ["Hector", 2019, NOW],
    ["ZS EV", 2020, NOW],
    ["Hector Plus", 2020, NOW],
    ["Gloster", 2020, NOW],
    ["Astor", 2021, NOW],
    ["Comet EV", 2023, NOW],
    ["Windsor EV", 2024, NOW],
  ],
  Jeep: [
    ["Wrangler", 2016, NOW],
    ["Grand Cherokee", 2016, NOW],
    ["Compass", 2017, NOW],
    ["Meridian", 2022, NOW],
  ],
  Fiat: [
    ["Uno", 1996, 2002],
    ["Palio", 2001, 2009],
    ["Petra", 2002, 2007],
    ["Adventure", 2005, 2010],
    ["Grande Punto", 2009, 2015],
    ["Linea", 2009, 2018],
    ["Punto Evo", 2014, 2019],
    ["Avventura", 2014, 2019],
    ["Abarth Punto", 2015, 2019],
  ],
  Datsun: [
    ["GO", 2014, 2022],
    ["GO+", 2015, 2022],
    ["redi-GO", 2016, 2022],
  ],
  Mitsubishi: [
    ["Lancer", 1998, 2012],
    ["Pajero", 2002, 2012],
    ["Cedia", 2006, 2013],
    ["Outlander", 2007, 2017],
    ["Montero", 2007, 2015],
    ["Pajero Sport", 2012, 2019],
  ],
  Isuzu: [
    ["MU-7", 2013, 2016],
    ["D-Max", 2014, NOW],
    ["V-Cross", 2016, NOW],
    ["MU-X", 2017, NOW],
  ],
  Citroen: [
    ["C5 Aircross", 2021, NOW],
    ["C3", 2022, NOW],
    ["eC3", 2023, NOW],
    ["C3 Aircross", 2023, NOW],
    ["Basalt", 2024, NOW],
  ],
  "Force Motors": [
    ["Trax Cruiser", 2000, NOW],
    ["One", 2011, 2016],
    ["Gurkha", 2013, NOW],
    ["Urbania", 2023, NOW],
  ],
  Premier: [
    ["Padmini", 1964, 2000],
    ["Sigma", 2009, 2013],
    ["Rio", 2009, 2015],
  ],
  "Hindustan Motors": [
    ["Ambassador", 1958, 2014],
    ["Contessa", 1984, 2002],
  ],
  Daewoo: [
    ["Matiz", 1998, 2003],
    ["Cielo", 1995, 2001],
    ["Nexia", 1996, 2001],
  ],
  Opel: [
    ["Astra", 1996, 2003],
    ["Corsa", 2000, 2005],
    ["Vectra", 2003, 2006],
  ],
  BMW: [
    ["3 Series", 2006, NOW],
    ["5 Series", 2003, NOW],
    ["7 Series", 2003, NOW],
    ["X1", 2010, NOW],
    ["X3", 2007, NOW],
    ["X5", 2003, NOW],
    ["X6", 2009, NOW],
    ["X7", 2019, NOW],
    ["1 Series", 2013, 2019],
    ["2 Series", 2015, NOW],
    ["6 Series", 2007, 2019],
    ["Z4", 2009, NOW],
    ["i4", 2022, NOW],
    ["iX1", 2023, NOW],
  ],
  "Mercedes-Benz": [
    ["C-Class", 2001, NOW],
    ["E-Class", 2000, NOW],
    ["S-Class", 2000, NOW],
    ["M-Class", 2002, 2015],
    ["GL-Class", 2007, 2016],
    ["A-Class", 2013, NOW],
    ["B-Class", 2012, 2019],
    ["CLA", 2015, NOW],
    ["GLA", 2014, NOW],
    ["GLC", 2016, NOW],
    ["GLE", 2015, NOW],
    ["GLS", 2016, NOW],
    ["EQS", 2022, NOW],
  ],
  Audi: [
    ["A4", 2004, NOW],
    ["A6", 2005, NOW],
    ["A8 L", 2006, NOW],
    ["Q7", 2007, NOW],
    ["Q5", 2009, NOW],
    ["Q3", 2012, NOW],
    ["A3", 2014, 2020],
    ["Q8", 2020, NOW],
    ["e-tron GT", 2021, NOW],
  ],
  Volvo: [
    ["S80", 2007, 2016],
    ["XC90", 2007, NOW],
    ["S60", 2009, 2022],
    ["XC60", 2010, NOW],
    ["V40", 2013, 2019],
    ["XC40", 2018, NOW],
    ["S90", 2016, NOW],
    ["C40 Recharge", 2022, NOW],
  ],
  Jaguar: [
    ["XF", 2009, NOW],
    ["XJ", 2010, 2019],
    ["XE", 2016, 2021],
    ["F-Type", 2013, NOW],
    ["F-Pace", 2016, NOW],
    ["I-Pace", 2021, NOW],
  ],
  "Land Rover": [
    ["Freelander", 2007, 2015],
    ["Discovery", 2005, NOW],
    ["Discovery Sport", 2015, NOW],
    ["Range Rover", 2005, NOW],
    ["Range Rover Sport", 2006, NOW],
    ["Range Rover Evoque", 2011, NOW],
    ["Range Rover Velar", 2017, NOW],
    ["Defender", 2020, NOW],
  ],
  Lexus: [
    ["ES", 2017, NOW],
    ["NX", 2017, NOW],
    ["RX", 2017, NOW],
    ["LX", 2017, NOW],
    ["LS", 2017, NOW],
    ["LM", 2023, NOW],
  ],
  MINI: [
    ["Cooper", 2012, NOW],
    ["Countryman", 2012, NOW],
    ["Clubman", 2016, 2023],
    ["Cooper SE", 2020, NOW],
  ],
  Porsche: [
    ["Cayenne", 2004, NOW],
    ["911", 2004, NOW],
    ["Panamera", 2010, NOW],
    ["Macan", 2014, NOW],
    ["718", 2016, NOW],
    ["Taycan", 2021, NOW],
  ],
  Tesla: [
    ["Model 3", 2025, NOW],
    ["Model Y", 2025, NOW],
  ],
  BYD: [
    ["e6", 2022, NOW],
    ["Atto 3", 2022, NOW],
    ["Seal", 2023, NOW],
    ["eMAX 7", 2024, NOW],
    ["Sealion 7", 2025, NOW],
  ],
  VinFast: [
    ["VF6", 2025, NOW],
    ["VF7", 2025, NOW],
  ],
  Maserati: [
    ["Quattroporte", 2011, NOW],
    ["Ghibli", 2014, NOW],
    ["Levante", 2016, NOW],
    ["Grecale", 2023, NOW],
  ],
  Bentley: [
    ["Continental GT", 2004, NOW],
    ["Flying Spur", 2006, NOW],
    ["Bentayga", 2016, NOW],
  ],
  "Rolls-Royce": [
    ["Phantom", 2005, NOW],
    ["Ghost", 2010, NOW],
    ["Cullinan", 2018, NOW],
    ["Spectre", 2024, NOW],
  ],
  "Aston Martin": [
    ["Vantage", 2011, NOW],
    ["DB11", 2017, 2023],
    ["DBX", 2020, NOW],
    ["DB12", 2023, NOW],
  ],
  Lamborghini: [
    ["Gallardo", 2005, 2013],
    ["Aventador", 2011, 2022],
    ["Huracan", 2014, NOW],
    ["Urus", 2018, NOW],
    ["Revuelto", 2024, NOW],
  ],
  Ferrari: [
    ["California", 2010, 2017],
    ["488", 2016, 2019],
    ["Roma", 2021, NOW],
    ["296 GTB", 2022, NOW],
    ["SF90", 2021, NOW],
    ["Purosangue", 2023, NOW],
  ],
};

const slug = (s: string) =>
  s.toLowerCase().replace(/\+/g, "-plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const BRANDS_CATALOG: Brand[] = Object.keys(catalog)
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({ id: slug(name), name }));

export const MODELS_CATALOG: Model[] = BRANDS_CATALOG.flatMap((brand) =>
  (catalog[brand.name] ?? []).map(([name, startYear, endYear]) => ({
    id: `${brand.id}--${slug(name)}`,
    brandId: brand.id,
    brandName: brand.name,
    name,
    startYear,
    endYear,
  })),
);

export const BRAND_NAMES = BRANDS_CATALOG.map((b) => b.name);

/** All model names, de-duplicated and sorted (used only for "All Brands"). */
export const ALL_MODEL_NAMES = Array.from(new Set(MODELS_CATALOG.map((m) => m.name))).sort((a, b) =>
  a.localeCompare(b),
);

/** Year filter options, newest first. Grows automatically with CURRENT_YEAR. */
export const YEAR_OPTIONS: string[] = Array.from(
  { length: CURRENT_YEAR - OLDEST_FILTER_YEAR + 1 },
  (_, i) => String(CURRENT_YEAR - i),
);

export const getBrandByName = (name: string) => BRANDS_CATALOG.find((b) => b.name === name);

const inYear = (m: Model, year?: number | null) =>
  !year || (year >= m.startYear && year <= m.endYear);

const toYear = (year?: string | number | null): number | undefined => {
  const n = typeof year === "string" ? Number(year) : year;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

/**
 * Models belonging to a brand name, optionally restricted to a model year.
 * Empty brand -> every model (optionally year-filtered) across all brands.
 */
export const modelsForBrand = (
  brandName?: string | null,
  year?: string | number | null,
): string[] => {
  const y = toYear(year);
  const list = MODELS_CATALOG.filter(
    (m) => (!brandName || m.brandName === brandName) && inYear(m, y),
  ).map((m) => m.name);
  const uniqueList = Array.from(new Set(list));
  return brandName ? uniqueList : uniqueList.sort((a, b) => a.localeCompare(b));
};

/** Brands that had at least one model on sale in the given year. */
export const brandsForYear = (year?: string | number | null): string[] => {
  const y = toYear(year);
  if (!y) return BRAND_NAMES;
  const names = new Set(MODELS_CATALOG.filter((m) => inYear(m, y)).map((m) => m.brandName));
  return BRAND_NAMES.filter((b) => names.has(b));
};

/** True when the model actually belongs to the brand (and year, if given). */
export const isValidBrandModel = (
  brandName: string,
  modelName: string,
  year?: string | number | null,
) => modelsForBrand(brandName, year).includes(modelName);

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] as const;
export const TRANSMISSION_TYPES = ["Manual", "Automatic"] as const;
