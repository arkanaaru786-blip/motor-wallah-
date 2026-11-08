/**
 * Partner portal data: workshop job cards, parts/decor orders and stock.
 *
 * Every read and write takes the signed-in partner's id and filters on it, so
 * one workshop can never open another workshop's job card by editing the URL or
 * a form value. The demo book is created once per partner account; it is the
 * mock-phase equivalent of the workshop / order tables production keeps in
 * Supabase.
 */
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { DECOR_CATEGORY_LIST } from "@/lib/decor-store";
import { PART_CATEGORY_LIST } from "@/lib/parts-store";
import type { PartnerType } from "@/lib/partners";

const JOBS_KEY = "mw_partner_jobs_v1";
const ORDERS_KEY = "mw_partner_orders_v1";
const INVENTORY_KEY = "mw_partner_inventory_v1";

/* ------------------------------------------------------------- job cards */

export const JOB_STATUSES = [
  "Pending",
  "In Progress",
  "Waiting for Parts",
  "Ready for Delivery",
  "Delivered",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const isJobStatus = (value: unknown): value is JobStatus =>
  typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);

export type JobNote = { id: string; at: string; author: string; text: string };

export type JobPart = { id: string; name: string; qty: number; cost: number };

export type JobTimeline = { status: JobStatus; at: string };

export type JobCard = {
  id: string;
  partnerId: string;
  bookingRef: string;
  status: JobStatus;
  customerName: string;
  mobile: string;
  vehicleNumber: string;
  vehicle: string;
  serviceType: string;
  scheduledFor: string;
  createdAt: string;
  updatedAt: string;
  estimatedCost: number;
  notes: JobNote[];
  parts: JobPart[];
  timeline: JobTimeline[];
};

/* ----------------------------------------------------------------- orders */

export const ORDER_STATUSES = ["New", "Packed", "Shipped", "Delivered", "Cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);

export type OrderItem = { name: string; qty: number; price: number };

export type PartnerOrder = {
  id: string;
  partnerId: string;
  itemType: "parts" | "decor";
  customerName: string;
  mobile: string;
  city: string;
  address: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: string;
  updatedAt: string;
  history: { status: OrderStatus; at: string }[];
};

/* -------------------------------------------------------------- inventory */

export type InventoryItem = {
  id: string;
  partnerId: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  updatedAt: string;
};

export type PartnerDataResult = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ read */

function readJobs(): JobCard[] {
  const raw = replicaRead<unknown>(JOBS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return (raw as JobCard[]).filter(
    (job) => job && typeof job.id === "string" && typeof job.partnerId === "string",
  );
}

function readOrders(): PartnerOrder[] {
  const raw = replicaRead<unknown>(ORDERS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return (raw as PartnerOrder[]).filter(
    (order) => order && typeof order.id === "string" && typeof order.partnerId === "string",
  );
}

function readInventory(): InventoryItem[] {
  const raw = replicaRead<unknown>(INVENTORY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return (raw as InventoryItem[]).filter(
    (item) => item && typeof item.id === "string" && typeof item.partnerId === "string",
  );
}

export const partnerJobs = (partnerId: string): JobCard[] =>
  readJobs()
    .filter((job) => job.partnerId === partnerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const partnerOrders = (partnerId: string): PartnerOrder[] =>
  readOrders()
    .filter((order) => order.partnerId === partnerId)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));

export const partnerInventory = (partnerId: string): InventoryItem[] =>
  readInventory()
    .filter((item) => item.partnerId === partnerId)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

export const orderTotal = (order: PartnerOrder): number =>
  order.items.reduce((sum, item) => sum + item.qty * item.price, 0);

export const jobPartsCost = (job: JobCard): number =>
  job.parts.reduce((sum, part) => sum + part.qty * part.cost, 0);

/* ---------------------------------------------------------------- seeding */

const at = (daysFromNow: number, hour = 10): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const note = (id: string, daysAgo: number, text: string): JobNote => ({
  id,
  at: at(-daysAgo, 12),
  author: "Mechanic desk",
  text,
});

const part = (id: string, name: string, qty: number, cost: number): JobPart => ({
  id,
  name,
  qty,
  cost,
});

function timelineFor(status: JobStatus, startedAt: string): JobTimeline[] {
  const index = JOB_STATUSES.indexOf(status);
  const start = Date.parse(startedAt);
  return JOB_STATUSES.slice(0, index + 1).map((stage, offset) => ({
    status: stage,
    at: new Date(start + offset * 4 * 60 * 60 * 1000).toISOString(),
  }));
}

function buildJobs(partnerId: string): JobCard[] {
  const seeds: {
    customerName: string;
    mobile: string;
    vehicleNumber: string;
    vehicle: string;
    serviceType: string;
    status: JobStatus;
    created: string;
    scheduled: string;
    estimatedCost: number;
    notes: JobNote[];
    parts: JobPart[];
  }[] = [
    {
      customerName: "Amit Deshmukh",
      mobile: "9821123401",
      vehicleNumber: "MH12AB4521",
      vehicle: "Maruti Swift VXi 2019",
      serviceType: "General Service",
      status: "Pending",
      created: at(0, 9),
      scheduled: at(1, 10),
      estimatedCost: 4500,
      notes: [],
      parts: [],
    },
    {
      customerName: "Sneha Kulkarni",
      mobile: "9822234502",
      vehicleNumber: "MH14CD7788",
      vehicle: "Hyundai Creta SX 2021",
      serviceType: "AC Service & Gas Refill",
      status: "In Progress",
      created: at(-1, 9),
      scheduled: at(0, 11),
      estimatedCost: 6200,
      notes: [note("n1", 0, "Cooling coil checked, no leak found. Regassing in progress.")],
      parts: [part("p1", "AC Gas R134a", 2, 2200), part("p2", "Cabin Air Filter", 1, 850)],
    },
    {
      customerName: "Rahul Patil",
      mobile: "9823345603",
      vehicleNumber: "MH12EF1290",
      vehicle: "Tata Nexon XZ 2020",
      serviceType: "Brake Overhaul",
      status: "Waiting for Parts",
      created: at(-2, 10),
      scheduled: at(-1, 10),
      estimatedCost: 7400,
      notes: [note("n1", 1, "Front pads worn below 2 mm. Ordered OEM pad set from the warehouse.")],
      parts: [part("p1", "Front Brake Pad Set", 1, 3400), part("p2", "Brake Fluid DOT 4", 1, 700)],
    },
    {
      customerName: "Farah Khan",
      mobile: "9824456704",
      vehicleNumber: "MH12GH4455",
      vehicle: "Honda City ZX 2018",
      serviceType: "Denting & Painting (Front Bumper)",
      status: "Ready for Delivery",
      created: at(-4, 9),
      scheduled: at(-3, 9),
      estimatedCost: 9800,
      notes: [note("n1", 1, "Paint cured. Final polish done, ready for handover.")],
      parts: [part("p1", "Front Bumper Repair Kit", 1, 1800)],
    },
    {
      customerName: "Vikram Joshi",
      mobile: "9825567805",
      vehicleNumber: "MH12JK9087",
      vehicle: "Mahindra XUV700 AX7 2022",
      serviceType: "Wheel Alignment & Balancing",
      status: "Delivered",
      created: at(-5, 9),
      scheduled: at(-4, 9),
      estimatedCost: 1800,
      notes: [note("n1", 3, "Alignment corrected, steering pull resolved. Delivered to customer.")],
      parts: [],
    },
    {
      customerName: "Priyanka Shinde",
      mobile: "9826678906",
      vehicleNumber: "MH12LM3321",
      vehicle: "Maruti Baleno Zeta 2021",
      serviceType: "Battery Replacement",
      status: "Pending",
      created: at(0, 8),
      scheduled: at(2, 10),
      estimatedCost: 7200,
      notes: [],
      parts: [part("p1", "Exide 12V Battery", 1, 6800)],
    },
  ];

  return seeds.map((seed, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return {
      id: `MW-JOB-${partnerId.slice(-4)}-${suffix}`,
      partnerId,
      bookingRef: `MW-SRV-${48213 + index}`,
      status: seed.status,
      customerName: seed.customerName,
      mobile: seed.mobile,
      vehicleNumber: seed.vehicleNumber,
      vehicle: seed.vehicle,
      serviceType: seed.serviceType,
      scheduledFor: seed.scheduled,
      createdAt: seed.created,
      updatedAt: seed.notes.at(0)?.at ?? seed.created,
      estimatedCost: seed.estimatedCost,
      notes: seed.notes,
      parts: seed.parts,
      timeline: timelineFor(seed.status, seed.created),
    };
  });
}

const PARTS_ORDER_SEEDS: {
  customerName: string;
  mobile: string;
  city: string;
  address: string;
  status: OrderStatus;
  daysAgo: number;
  items: OrderItem[];
}[] = [
  {
    customerName: "Rohan Mehta",
    mobile: "9867012345",
    city: "Mumbai",
    address: "A-402, Sunrise Residency, Andheri West",
    status: "New",
    daysAgo: 0,
    items: [
      { name: "Bosch Front Brake Pad Set", qty: 1, price: 2890 },
      { name: "Brake Fluid DOT 4", qty: 1, price: 449 },
    ],
  },
  {
    customerName: "Anita Rao",
    mobile: "9867123456",
    city: "Pune",
    address: "12, Green Park Society, Kothrud",
    status: "New",
    daysAgo: 0,
    items: [{ name: "NGK Spark Plug Set", qty: 1, price: 1290 }],
  },
  {
    customerName: "Sameer Khan",
    mobile: "9867234567",
    city: "Thane",
    address: "B-18, Lake View Heights, Ghodbunder Road",
    status: "Packed",
    daysAgo: 1,
    items: [
      { name: "Amaron 12V Battery", qty: 1, price: 8490 },
      { name: "Battery Terminal Kit", qty: 1, price: 320 },
    ],
  },
  {
    customerName: "Meera Iyer",
    mobile: "9867345678",
    city: "Navi Mumbai",
    address: "Flat 7C, Palm Beach, Vashi",
    status: "Shipped",
    daysAgo: 2,
    items: [{ name: "KYB Front Shock Absorber", qty: 2, price: 3450 }],
  },
  {
    customerName: "Arjun Singh",
    mobile: "9867456789",
    city: "Nashik",
    address: "Plot 44, Ambad Industrial Area",
    status: "Shipped",
    daysAgo: 3,
    items: [
      { name: "Hella LED Headlight Pair", qty: 1, price: 5290 },
      { name: "Fog Lamp Set", qty: 1, price: 2190 },
    ],
  },
  {
    customerName: "Deepa Nair",
    mobile: "9867567890",
    city: "Mumbai",
    address: "301, Sea Breeze, Bandra East",
    status: "Delivered",
    daysAgo: 5,
    items: [{ name: "Mahle Air Filter", qty: 2, price: 690 }],
  },
  {
    customerName: "Nikhil Jain",
    mobile: "9867678901",
    city: "Pune",
    address: "Shivneri Apartments, Hadapsar",
    status: "Cancelled",
    daysAgo: 6,
    items: [{ name: "MRF Tubeless Tyre 185/65 R15", qty: 2, price: 4890 }],
  },
];

const DECOR_ORDER_SEEDS: typeof PARTS_ORDER_SEEDS = [
  {
    customerName: "Karan Malhotra",
    mobile: "9878012345",
    city: "Bengaluru",
    address: "14, Indiranagar 2nd Stage",
    status: "New",
    daysAgo: 0,
    items: [
      { name: "Vega Full Seat Cover Set", qty: 1, price: 4990 },
      { name: "7D Floor Mat Set", qty: 1, price: 2890 },
    ],
  },
  {
    customerName: "Divya Menon",
    mobile: "9878123456",
    city: "Kochi",
    address: "Villa 9, Marine Drive",
    status: "Packed",
    daysAgo: 1,
    items: [{ name: "Philips Ambient Footwell Lights", qty: 1, price: 1990 }],
  },
  {
    customerName: "Siddharth Bose",
    mobile: "9878234567",
    city: "Kolkata",
    address: "22, Salt Lake Sector 2",
    status: "Shipped",
    daysAgo: 2,
    items: [
      { name: "JBL Component Speaker Set", qty: 1, price: 7490 },
      { name: "Tweeter Set", qty: 1, price: 2290 },
    ],
  },
  {
    customerName: "Neha Gupta",
    mobile: "9878345678",
    city: "Delhi",
    address: "C-77, Greater Kailash 1",
    status: "Delivered",
    daysAgo: 4,
    items: [{ name: "3M Microfiber Polish Kit", qty: 2, price: 899 }],
  },
  {
    customerName: "Aravind Reddy",
    mobile: "9878456789",
    city: "Hyderabad",
    address: "Plot 18, Jubilee Hills",
    status: "New",
    daysAgo: 0,
    items: [
      { name: "Stylo Boot Lid Spoiler", qty: 1, price: 3490 },
      { name: "Carbonx Window Visor Set", qty: 1, price: 1590 },
    ],
  },
  {
    customerName: "Pooja Bhatt",
    mobile: "9878567890",
    city: "Ahmedabad",
    address: "B-9, Satellite Road",
    status: "Cancelled",
    daysAgo: 5,
    items: [{ name: "Blaupunkt 4-Channel Amplifier", qty: 1, price: 8990 }],
  },
];

function buildOrders(partnerId: string, type: "parts" | "decor"): PartnerOrder[] {
  const seeds = type === "parts" ? PARTS_ORDER_SEEDS : DECOR_ORDER_SEEDS;
  return seeds.map((seed, index) => {
    const placedAt = at(-seed.daysAgo, 10 + (index % 6));
    const statusIndex = ORDER_STATUSES.indexOf(seed.status);
    // A cancelled order stopped before delivery, so its history must not read
    // "Delivered → Cancelled".
    const chain: OrderStatus[] =
      seed.status === "Cancelled" ? ["New", "Cancelled"] : ORDER_STATUSES.slice(0, statusIndex + 1);
    return {
      id: `MW-ORD-${partnerId.slice(-4)}-${String(index + 1).padStart(2, "0")}`,
      partnerId,
      itemType: type,
      customerName: seed.customerName,
      mobile: seed.mobile,
      city: seed.city,
      address: seed.address,
      items: seed.items,
      status: seed.status,
      placedAt,
      updatedAt: at(-Math.max(0, seed.daysAgo - 1), 15),
      history: chain.map((status, offset) => ({
        status,
        at: new Date(Date.parse(placedAt) + offset * 8 * 60 * 60 * 1000).toISOString(),
      })),
    };
  });
}

function buildInventory(partnerId: string, type: PartnerType): InventoryItem[] {
  const updatedAt = new Date().toISOString();
  if (type === "workshop") return [];

  const list = type === "parts" ? PART_CATEGORY_LIST : DECOR_CATEGORY_LIST;
  const wanted =
    type === "parts" ? [0, 0, 1, 1, 2, 3, 4, 5, 5, 6, 7, 7] : [0, 0, 1, 2, 2, 3, 3, 4, 5, 6];

  const items: InventoryItem[] = [];
  wanted.forEach((categoryIndex, index) => {
    const category = list[categoryIndex % list.length];
    if (!category) return;
    const vendor = ("vendors" in category ? category.vendors : category.brands)[
      index % ("vendors" in category ? category.vendors.length : category.brands.length)
    ];
    const itemName = category.items[index % category.items.length]!;
    const price =
      Math.round(
        (category.min + ((category.max - category.min) * ((index * 37) % 100)) / 100) / 10,
      ) * 10;
    items.push({
      id: `${partnerId}-I${String(index + 1).padStart(2, "0")}`,
      partnerId,
      name: `${vendor ?? "Genuine"} ${itemName}`,
      category: category.label,
      sku: `${category.id.slice(0, 3).toUpperCase()}-${String(1000 + index + 1)}`,
      price,
      stock: 4 + ((index * 7) % 26),
      updatedAt,
    });
  });
  return items;
}

/** Create this partner's demo book once. Existing rows are never replaced. */
export function seedPartnerData(partner: { partnerId: string; type: PartnerType }): void {
  const jobs = readJobs();
  if (!jobs.some((job) => job.partnerId === partner.partnerId)) {
    if (partner.type === "workshop") {
      replicaWrite(JOBS_KEY, [...jobs, ...buildJobs(partner.partnerId)]);
    }
  }

  const orders = readOrders();
  if (!orders.some((order) => order.partnerId === partner.partnerId)) {
    if (partner.type === "parts" || partner.type === "decor") {
      replicaWrite(ORDERS_KEY, [...orders, ...buildOrders(partner.partnerId, partner.type)]);
    }
  }

  const inventory = readInventory();
  if (!inventory.some((item) => item.partnerId === partner.partnerId)) {
    replicaWrite(INVENTORY_KEY, [...inventory, ...buildInventory(partner.partnerId, partner.type)]);
  }
}

/* ---------------------------------------------------------------- writes */

function ownJob(partnerId: string, jobId: string): JobCard | null {
  const job = readJobs().find((item) => item.id === jobId);
  if (!job || job.partnerId !== partnerId) return null;
  return job;
}

function writeJob(partnerId: string, updated: JobCard): PartnerDataResult {
  const jobs = readJobs();
  if (!jobs.some((job) => job.id === updated.id && job.partnerId === partnerId)) {
    return { ok: false, error: "That job card is not assigned to this workshop." };
  }
  if (
    !replicaWrite(
      JOBS_KEY,
      jobs.map((job) => (job.id === updated.id ? updated : job)),
    )
  ) {
    return { ok: false, error: "Storage is full or blocked, so the change was not saved." };
  }
  return { ok: true };
}

export function updateJobStatus(
  partnerId: string,
  jobId: string,
  status: JobStatus,
): PartnerDataResult {
  if (!isJobStatus(status)) return { ok: false, error: "Choose a valid job status." };
  const job = ownJob(partnerId, jobId);
  if (!job) return { ok: false, error: "That job card is not assigned to this workshop." };
  if (job.status === status) return { ok: true };
  const now = new Date().toISOString();
  return writeJob(partnerId, {
    ...job,
    status,
    updatedAt: now,
    timeline: [...job.timeline, { status, at: now }],
  });
}

export function addJobNote(
  partnerId: string,
  jobId: string,
  text: string,
  author: string,
): PartnerDataResult {
  const clean = text.trim();
  if (clean.length < 2) return { ok: false, error: "Write a short mechanic note first." };
  if (clean.length > 600) return { ok: false, error: "Keep the note under 600 characters." };
  const job = ownJob(partnerId, jobId);
  if (!job) return { ok: false, error: "That job card is not assigned to this workshop." };
  const now = new Date().toISOString();
  return writeJob(partnerId, {
    ...job,
    updatedAt: now,
    notes: [{ id: `note-${Date.now()}`, at: now, author, text: clean }, ...job.notes],
  });
}

export function addJobPart(
  partnerId: string,
  jobId: string,
  input: { name: string; qty: number; cost: number },
): PartnerDataResult {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter the part name." };
  if (!Number.isFinite(input.qty) || input.qty < 1) {
    return { ok: false, error: "Quantity must be at least 1." };
  }
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return { ok: false, error: "Enter a valid part cost." };
  }
  const job = ownJob(partnerId, jobId);
  if (!job) return { ok: false, error: "That job card is not assigned to this workshop." };
  return writeJob(partnerId, {
    ...job,
    updatedAt: new Date().toISOString(),
    parts: [
      ...job.parts,
      { id: `part-${Date.now()}`, name, qty: Math.round(input.qty), cost: Math.round(input.cost) },
    ],
  });
}

export function removeJobPart(partnerId: string, jobId: string, partId: string): PartnerDataResult {
  const job = ownJob(partnerId, jobId);
  if (!job) return { ok: false, error: "That job card is not assigned to this workshop." };
  return writeJob(partnerId, {
    ...job,
    updatedAt: new Date().toISOString(),
    parts: job.parts.filter((item) => item.id !== partId),
  });
}

export function setJobEstimate(
  partnerId: string,
  jobId: string,
  estimatedCost: number,
): PartnerDataResult {
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return { ok: false, error: "Enter a valid estimated cost." };
  }
  const job = ownJob(partnerId, jobId);
  if (!job) return { ok: false, error: "That job card is not assigned to this workshop." };
  return writeJob(partnerId, {
    ...job,
    estimatedCost: Math.round(estimatedCost),
    updatedAt: new Date().toISOString(),
  });
}

/* ---------------------------------------------------------- order writes */

export function updateOrderStatus(
  partnerId: string,
  orderId: string,
  status: OrderStatus,
): PartnerDataResult {
  if (!isOrderStatus(status)) return { ok: false, error: "Choose a valid order status." };
  const orders = readOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order || order.partnerId !== partnerId) {
    return { ok: false, error: "That order is not assigned to this partner." };
  }
  if (order.status === status) return { ok: true };
  const now = new Date().toISOString();
  const next: PartnerOrder = {
    ...order,
    status,
    updatedAt: now,
    history: [...order.history, { status, at: now }],
  };
  if (
    !replicaWrite(
      ORDERS_KEY,
      orders.map((item) => (item.id === orderId ? next : item)),
    )
  ) {
    return { ok: false, error: "Storage is full or blocked, so the change was not saved." };
  }
  return { ok: true };
}

/* ------------------------------------------------------- inventory writes */

export type InventoryInput = {
  name: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
};

function validateInventory(input: InventoryInput): string | null {
  if (input.name.trim().length < 2) return "Enter the item name.";
  if (input.category.trim().length < 2) return "Choose a category.";
  if (!Number.isFinite(input.price) || input.price < 0) return "Enter a valid price.";
  if (!Number.isFinite(input.stock) || input.stock < 0) return "Enter a valid stock quantity.";
  return null;
}

export function addInventoryItem(partnerId: string, input: InventoryInput): PartnerDataResult {
  const invalid = validateInventory(input);
  if (invalid) return { ok: false, error: invalid };
  const items = readInventory();
  const item: InventoryItem = {
    id: `${partnerId}-I${Date.now()}`,
    partnerId,
    name: input.name.trim().replace(/\s+/g, " "),
    category: input.category.trim(),
    sku: input.sku.trim().toUpperCase() || `MW-${String(Date.now()).slice(-6)}`,
    price: Math.round(input.price),
    stock: Math.round(input.stock),
    updatedAt: new Date().toISOString(),
  };
  if (!replicaWrite(INVENTORY_KEY, [...items, item])) {
    return { ok: false, error: "Storage is full or blocked, so the item was not saved." };
  }
  return { ok: true };
}

export function updateInventoryItem(
  partnerId: string,
  itemId: string,
  input: InventoryInput,
): PartnerDataResult {
  const invalid = validateInventory(input);
  if (invalid) return { ok: false, error: invalid };
  const items = readInventory();
  const item = items.find((row) => row.id === itemId);
  if (!item || item.partnerId !== partnerId) {
    return { ok: false, error: "That stock item is not assigned to this partner." };
  }
  const next: InventoryItem = {
    ...item,
    name: input.name.trim().replace(/\s+/g, " "),
    category: input.category.trim(),
    sku: input.sku.trim().toUpperCase(),
    price: Math.round(input.price),
    stock: Math.round(input.stock),
    updatedAt: new Date().toISOString(),
  };
  if (
    !replicaWrite(
      INVENTORY_KEY,
      items.map((row) => (row.id === itemId ? next : row)),
    )
  ) {
    return { ok: false, error: "Storage is full or blocked, so the change was not saved." };
  }
  return { ok: true };
}

export function removeInventoryItem(partnerId: string, itemId: string): PartnerDataResult {
  const items = readInventory();
  const item = items.find((row) => row.id === itemId);
  if (!item || item.partnerId !== partnerId) {
    return { ok: false, error: "That stock item is not assigned to this partner." };
  }
  if (
    !replicaWrite(
      INVENTORY_KEY,
      items.filter((row) => row.id !== itemId),
    )
  ) {
    return { ok: false, error: "Storage is full or blocked, so the item was not removed." };
  }
  return { ok: true };
}
