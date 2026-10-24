/**
 * Pre-populated BUY marketplace demo inventory (requested test data).
 *
 * Raw records only — src/lib/buy-catalog.ts maps these into BuyListing rows
 * (assigning the same honest demo photos, `demo: true`, `verified: false`).
 * Nothing here claims real Motor Wallah stock; every record stays labelled as
 * a demo listing in the UI.
 *
 * Deliberately separate from src/lib/vehicle-categories.ts so the datasets the
 * homepage popular-vehicles section derives from stay untouched.
 *
 * Every `model` matches a name in its category's Brand -> Model catalogue, so
 * the model dropdown filter always yields these listings. Both active and
 * discontinued models are included (Maruti Zen / Esteem, Hyundai Santro …).
 */

type DemoCarInput = {
  id: string;
  make: string;
  model: string;
  variant: string;
  bodyType: "Hatchback" | "Sedan" | "SUV" | "MUV";
  year: number;
  priceLakh: number;
  kilometres: number;
  fuel: string;
  transmission: string;
  location: string;
  ownership: string;
};

type DemoListingInput = {
  id: string;
  /** Matches a CategoryId in vehicle-categories.ts, or "cars". */
  categoryId: string;
  brand: string;
  model: string;
  year: number;
  priceLakh: number;
  kilometres: number;
  fuel: string;
  transmission: string | null;
  city: string;
  ownership: string;
};

/** Extra car records so every required car model has a listing to browse. */
export const EXTRA_DEMO_CARS: DemoCarInput[] = [
  { id: "dcar-01", make: "Tata", model: "Punch", variant: "Adventure", bodyType: "SUV", year: 2023, priceLakh: 6.75, kilometres: 18000, fuel: "Petrol", transmission: "Manual", location: "Indore", ownership: "First Owner" },
  { id: "dcar-02", make: "Tata", model: "Harrier", variant: "XZ", bodyType: "SUV", year: 2021, priceLakh: 15.75, kilometres: 52000, fuel: "Diesel", transmission: "Manual", location: "Indore", ownership: "First Owner" },
  { id: "dcar-03", make: "Tata", model: "Tiago", variant: "XZ", bodyType: "Hatchback", year: 2020, priceLakh: 5.2, kilometres: 35000, fuel: "Petrol", transmission: "Manual", location: "Indore", ownership: "First Owner" },
  { id: "dcar-04", make: "Tata", model: "Sierra", variant: "Pure", bodyType: "SUV", year: 2025, priceLakh: 16.9, kilometres: 15000, fuel: "Petrol", transmission: "Automatic", location: "Bhopal", ownership: "First Owner" },
  { id: "dcar-05", make: "Maruti Suzuki", model: "Swift", variant: "VXi", bodyType: "Hatchback", year: 2019, priceLakh: 5.4, kilometres: 46000, fuel: "Petrol", transmission: "Manual", location: "Indore", ownership: "Second Owner" },
  { id: "dcar-06", make: "Maruti Suzuki", model: "Zen", variant: "VXi", bodyType: "Hatchback", year: 2003, priceLakh: 1.35, kilometres: 82000, fuel: "Petrol", transmission: "Manual", location: "Ujjain", ownership: "Second Owner" },
  { id: "dcar-07", make: "Maruti Suzuki", model: "Esteem", variant: "VXi", bodyType: "Sedan", year: 2004, priceLakh: 1.15, kilometres: 96000, fuel: "Petrol", transmission: "Manual", location: "Dewas", ownership: "Third Owner" },
  { id: "dcar-08", make: "Hyundai", model: "Santro Xing", variant: "GL", bodyType: "Hatchback", year: 2010, priceLakh: 1.9, kilometres: 68000, fuel: "Petrol", transmission: "Manual", location: "Bhopal", ownership: "Second Owner" },
];

/** Extra non-car records covering the required test data for every category. */
export const EXTRA_DEMO_LISTINGS: DemoListingInput[] = [
  // --- Bikes: Hero, Bajaj, Royal Enfield ---------------------------------
  { id: "dbike-01", categoryId: "bikes", brand: "Hero", model: "Splendor Plus", year: 2022, priceLakh: 0.72, kilometres: 18000, fuel: "Petrol", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbike-02", categoryId: "bikes", brand: "Hero", model: "Xpulse 200", year: 2023, priceLakh: 1.15, kilometres: 9000, fuel: "Petrol", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbike-03", categoryId: "bikes", brand: "Hero", model: "Passion Pro", year: 2021, priceLakh: 0.68, kilometres: 24000, fuel: "Petrol", transmission: "Manual", city: "Bhopal", ownership: "Second Owner" },
  { id: "dbike-04", categoryId: "bikes", brand: "Bajaj", model: "Pulsar 150", year: 2021, priceLakh: 0.95, kilometres: 21000, fuel: "Petrol", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbike-05", categoryId: "bikes", brand: "Bajaj", model: "Dominar 400", year: 2022, priceLakh: 1.6, kilometres: 14000, fuel: "Petrol", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbike-06", categoryId: "bikes", brand: "Bajaj", model: "Chetak", year: 2023, priceLakh: 0.95, kilometres: 6000, fuel: "Electric", transmission: "Automatic", city: "Ujjain", ownership: "First Owner" },
  { id: "dbike-07", categoryId: "bikes", brand: "Royal Enfield", model: "Classic 350", year: 2022, priceLakh: 1.75, kilometres: 16000, fuel: "Petrol", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbike-08", categoryId: "bikes", brand: "Royal Enfield", model: "Bullet 350", year: 2019, priceLakh: 1.2, kilometres: 32000, fuel: "Petrol", transmission: "Manual", city: "Bhopal", ownership: "Second Owner" },

  // --- 3-Wheelers: Mahindra, Piaggio, local EV brands --------------------
  { id: "d3w-01", categoryId: "three-wheelers", brand: "Mahindra (3W)", model: "Treo", year: 2023, priceLakh: 3.1, kilometres: 12000, fuel: "Electric", transmission: "Automatic", city: "Indore", ownership: "First Owner" },
  { id: "d3w-02", categoryId: "three-wheelers", brand: "Mahindra (3W)", model: "Alfa", year: 2021, priceLakh: 2.4, kilometres: 24000, fuel: "CNG", transmission: "Manual", city: "Bhopal", ownership: "First Owner" },
  { id: "d3w-03", categoryId: "three-wheelers", brand: "Piaggio", model: "Ape City", year: 2022, priceLakh: 2.6, kilometres: 18000, fuel: "CNG", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "d3w-04", categoryId: "three-wheelers", brand: "Khalsa EV", model: "E-Rickshaw Deluxe", year: 2023, priceLakh: 1.85, kilometres: 8000, fuel: "Electric", transmission: "Automatic", city: "Indore", ownership: "First Owner" },
  { id: "d3w-05", categoryId: "three-wheelers", brand: "All Fine EV", model: "E-Rickshaw Gold", year: 2022, priceLakh: 1.75, kilometres: 11000, fuel: "Electric", transmission: "Automatic", city: "Bhopal", ownership: "First Owner" },

  // --- Trucks: Tata (Ace, 407, Prima), Ashok Leyland (Dost, Ecomet) -------
  { id: "dtruck-01", categoryId: "trucks", brand: "Tata Motors", model: "Ace", year: 2021, priceLakh: 4.6, kilometres: 38000, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dtruck-02", categoryId: "trucks", brand: "Tata Motors", model: "407", year: 2019, priceLakh: 6.9, kilometres: 76000, fuel: "Diesel", transmission: "Manual", city: "Bhopal", ownership: "Second Owner" },
  { id: "dtruck-03", categoryId: "trucks", brand: "Tata Motors", model: "Prima 5530", year: 2020, priceLakh: 28.5, kilometres: 92000, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dtruck-04", categoryId: "trucks", brand: "Ashok Leyland", model: "Dost", year: 2022, priceLakh: 5.4, kilometres: 44000, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dtruck-05", categoryId: "trucks", brand: "Ashok Leyland", model: "Ecomet 1615", year: 2021, priceLakh: 14.5, kilometres: 68000, fuel: "Diesel", transmission: "Manual", city: "Dewas", ownership: "First Owner" },

  // --- Buses: Tata (Starbus, Magna), Ashok Leyland (Viking) ---------------
  { id: "dbus-01", categoryId: "buses", brand: "Tata Buses", model: "Starbus", year: 2020, priceLakh: 18.5, kilometres: 110000, fuel: "Diesel", transmission: "Manual", city: "Bhopal", ownership: "First Owner" },
  { id: "dbus-02", categoryId: "buses", brand: "Tata Buses", model: "Magna", year: 2021, priceLakh: 22.0, kilometres: 88000, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dbus-03", categoryId: "buses", brand: "Ashok Leyland Buses", model: "Viking", year: 2019, priceLakh: 16.5, kilometres: 135000, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "Second Owner" },

  // --- Tractors: Mahindra, Swaraj, John Deere ----------------------------
  { id: "dtrac-01", categoryId: "tractors", brand: "Mahindra", model: "275 DI", year: 2020, priceLakh: 3.9, kilometres: 2600, fuel: "Diesel", transmission: "Manual", city: "Ujjain", ownership: "First Owner" },
  { id: "dtrac-02", categoryId: "tractors", brand: "Mahindra", model: "Arjun 555", year: 2021, priceLakh: 6.4, kilometres: 1900, fuel: "Diesel", transmission: "Manual", city: "Indore", ownership: "First Owner" },
  { id: "dtrac-03", categoryId: "tractors", brand: "Swaraj", model: "735 FE", year: 2019, priceLakh: 4.3, kilometres: 3400, fuel: "Diesel", transmission: "Manual", city: "Ujjain", ownership: "Second Owner" },
  { id: "dtrac-04", categoryId: "tractors", brand: "John Deere", model: "5050D", year: 2022, priceLakh: 6.8, kilometres: 1600, fuel: "Diesel", transmission: "Manual", city: "Bhopal", ownership: "First Owner" },
];
