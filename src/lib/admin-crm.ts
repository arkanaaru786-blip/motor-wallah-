/**
 * Master Tracker data — one table for every business case.
 *
 * Every flow on the site already funnels through `submitLead()` into the local
 * lead queue. This module turns those records into CRM cases, adds the demo
 * pipeline the control room needs on day one, and persists all edits (status,
 * assignment, notes, history) in the admin database.
 *
 * Like the rest of the project the database is device-local storage; the read
 * and write helpers below are the single seam to swap for a real API later.
 */
import { readLeadQueue, type Lead, type LeadType } from "./leads";

/* ------------------------------------------------------------------ types */

export const CASE_TYPES = [
  "Finance",
  "Insurance",
  "Service",
  "Franchise",
  "Sell",
  "Scrap",
  "Parts Order",
  "Decor Order",
  "Exchange",
  "Test Drive",
  "Vehicle Enquiry",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_STATUSES = [
  "New",
  "In Progress",
  "Awaiting Customer",
  "Awaiting Approval",
  "Won",
  "Closed",
  "Lost",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

/** Statuses that still need someone to act. */
const OPEN_STATUSES: CaseStatus[] = [
  "New",
  "In Progress",
  "Awaiting Customer",
  "Awaiting Approval",
];

export const isOpenStatus = (status: CaseStatus) => OPEN_STATUSES.includes(status);
export const isResolvedStatus = (status: CaseStatus) =>
  status === "Won" || status === "Closed" || status === "Lost";

export type CaseNote = { id: string; at: string; by: string; text: string };
export type CaseEvent = { id: string; at: string; by: string; label: string };

export type CrmCase = {
  id: string;
  type: CaseType;
  customerName: string;
  mobile: string;
  email: string | null;
  source: string;
  status: CaseStatus;
  priority: CasePriority;
  /** Employee id from `employees()`, or null when unassigned. */
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  /** SLA deadline derived from the case type's first-response target. */
  dueAt: string;
  /** Deal value in rupees; drives the revenue KPI for won cases. */
  value: number;
  vehicle: string | null;
  summary: string;
  approvalRequired: boolean;
  notes: CaseNote[];
  events: CaseEvent[];
  origin: "imported" | "demo" | "manual";
  /** Stable key so an imported lead is never duplicated. */
  sourceKey: string;
};

export type AdminEmployee = {
  id: string;
  name: string;
  role: string;
  desk: CaseType | "All";
  mobile: string;
};

export type ActivityEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  caseId: string | null;
};

export type SlaState = "On track" | "Due soon" | "Overdue" | "Met" | "Breached";

export type SlaInfo = { state: SlaState; label: string; hoursLeft: number };

/* -------------------------------------------------------------- key names */

const CASES_KEY = "mw_admin_cases_v1";
const EMPLOYEES_KEY = "mw_admin_employees_v1";
const ACTIVITY_KEY = "mw_admin_activity_v1";
const SEED_FLAG_KEY = "mw_admin_seeded_v1";

/** First-response SLA in hours, per business line. */
export const SLA_HOURS: Record<CaseType, number> = {
  Finance: 24,
  Insurance: 12,
  Service: 8,
  Franchise: 48,
  Sell: 24,
  Scrap: 24,
  "Parts Order": 12,
  "Decor Order": 24,
  Exchange: 24,
  "Test Drive": 6,
  "Vehicle Enquiry": 4,
};

/* ---------------------------------------------------------------- storage */

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the panel still renders with in-memory state */
  }
}

/* ------------------------------------------------------------- seed data */

const DEMO_EMPLOYEES: AdminEmployee[] = [
  {
    id: "emp-ananya",
    name: "Ananya Rao",
    role: "Finance Desk Lead",
    desk: "Finance",
    mobile: "9820011201",
  },
  {
    id: "emp-vikram",
    name: "Vikram Shetty",
    role: "Insurance Advisor",
    desk: "Insurance",
    mobile: "9820011202",
  },
  {
    id: "emp-rahul",
    name: "Rahul Menon",
    role: "Service Manager",
    desk: "Service",
    mobile: "9820011203",
  },
  {
    id: "emp-priyanka",
    name: "Priyanka Shah",
    role: "Sales Executive",
    desk: "All",
    mobile: "9820011204",
  },
  {
    id: "emp-aakash",
    name: "Aakash Verma",
    role: "Partnerships",
    desk: "Franchise",
    mobile: "9820011205",
  },
];

const HOUR = 60 * 60 * 1000;

type SeedRow = {
  type: CaseType;
  customerName: string;
  mobile: string;
  email?: string;
  source: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedTo: string | null;
  /** Hours ago the case was created. */
  ageHours: number;
  value: number;
  vehicle?: string;
  summary: string;
  approvalRequired?: boolean;
  notes?: string[];
};

const SEED_ROWS: SeedRow[] = [
  {
    type: "Finance",
    customerName: "Rahul Verma",
    mobile: "9811045230",
    email: "rahul.verma@example.com",
    source: "Marketplace",
    status: "Awaiting Approval",
    priority: "High",
    assignedTo: "emp-ananya",
    ageHours: 6,
    value: 840_000,
    vehicle: "Tata Nexon XZ+ 2022",
    summary: "Loan of ₹8.4L over 5 years, bank pre-check cleared, awaiting sanction letter.",
    approvalRequired: true,
    notes: ["Customer uploaded salary slips and 6-month bank statement.", "HDFC quoted 9.1%."],
  },
  {
    type: "Finance",
    customerName: "Sneha Kulkarni",
    mobile: "9822076412",
    source: "WhatsApp",
    status: "New",
    priority: "Critical",
    assignedTo: null,
    ageHours: 27,
    value: 1_260_000,
    vehicle: "Hyundai Creta SX 2023",
    summary: "Self-employed applicant, needs a co-applicant route. First response overdue.",
    approvalRequired: true,
  },
  {
    type: "Finance",
    customerName: "Imran Sheikh",
    mobile: "9867304511",
    source: "Phone",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "emp-ananya",
    ageHours: 52,
    value: 560_000,
    vehicle: "Maruti Suzuki Baleno Zeta 2022",
    summary: "Comparing two lenders; documents pending on ITR of the last two years.",
    notes: ["Called back, promised ITR by Friday."],
  },
  {
    type: "Finance",
    customerName: "Deepak Yadav",
    mobile: "9899123456",
    source: "Walk-in",
    status: "Won",
    priority: "Medium",
    assignedTo: "emp-ananya",
    ageHours: 240,
    value: 720_000,
    vehicle: "Honda City VX 2021",
    summary: "Disbursed with Bajaj Finance; welcome kit handed over.",
    notes: ["Sanction letter issued.", "Disbursal reference BF-88213."],
  },
  {
    type: "Insurance",
    customerName: "Priya Nair",
    mobile: "9700012233",
    source: "Website",
    status: "In Progress",
    priority: "High",
    assignedTo: "emp-vikram",
    ageHours: 9,
    value: 18_400,
    vehicle: "Kia Seltos HTX 2022",
    summary: "Comprehensive renewal due in 4 days; zero-depreciation add-on requested.",
  },
  {
    type: "Insurance",
    customerName: "Arjun Menon",
    mobile: "9744581120",
    source: "Marketplace",
    status: "New",
    priority: "Medium",
    assignedTo: null,
    ageHours: 15,
    value: 9_800,
    vehicle: "Bajaj Pulsar NS200 2021",
    summary: "Third-party to comprehensive upgrade quote requested.",
  },
  {
    type: "Insurance",
    customerName: "Kavita Joshi",
    mobile: "9611220087",
    source: "Referral",
    status: "Won",
    priority: "Low",
    assignedTo: "emp-vikram",
    ageHours: 190,
    value: 22_600,
    vehicle: "Toyota Innova Crysta 2019",
    summary: "Policy issued with ICICI Lombard, documents emailed.",
  },
  {
    type: "Service",
    customerName: "Sanjay Patil",
    mobile: "9663321874",
    source: "Website",
    status: "In Progress",
    priority: "Critical",
    assignedTo: "emp-rahul",
    ageHours: 11,
    value: 14_500,
    vehicle: "Tata Nexon 2021",
    summary: "Brake pull at speed reported; vehicle at Andheri workshop bay 3.",
    approvalRequired: true,
  },
  {
    type: "Service",
    customerName: "Meera Iyer",
    mobile: "9594401122",
    source: "Phone",
    status: "Awaiting Customer",
    priority: "Medium",
    assignedTo: "emp-rahul",
    ageHours: 30,
    value: 6_200,
    vehicle: "Maruti Suzuki Swift 2020",
    summary: "Estimate shared for clutch replacement, waiting on approval.",
  },
  {
    type: "Service",
    customerName: "Rohit Sharma",
    mobile: "9987012341",
    source: "Walk-in",
    status: "Won",
    priority: "Low",
    assignedTo: "emp-rahul",
    ageHours: 120,
    value: 3_900,
    vehicle: "Hyundai i20 2022",
    summary: "Periodic service completed and delivered the same day.",
  },
  {
    type: "Service",
    customerName: "Farhan Ali",
    mobile: "9810023498",
    source: "WhatsApp",
    status: "New",
    priority: "High",
    assignedTo: null,
    ageHours: 2,
    value: 8_700,
    vehicle: "Mahindra XUV700 2023",
    summary: "Door rattle under warranty; pickup slot requested for tomorrow morning.",
  },
  {
    type: "Franchise",
    customerName: "Vikram Singh",
    mobile: "9871234500",
    email: "vikram.singh@example.com",
    source: "Website",
    status: "Awaiting Approval",
    priority: "High",
    assignedTo: "emp-aakash",
    ageHours: 34,
    value: 2_500_000,
    vehicle: "Dealership — Pune (West)",
    summary: "Multi-brand dealership application for a 2,400 sq ft showroom in Baner.",
    approvalRequired: true,
    notes: ["Site photos and 3-year financials received.", "Reference MW-FR-0042."],
  },
  {
    type: "Franchise",
    customerName: "Naveen Reddy",
    mobile: "9849012388",
    source: "Referral",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "emp-aakash",
    ageHours: 70,
    value: 1_800_000,
    vehicle: "Workshop — Hyderabad (Kondapur)",
    summary: "Service workshop franchise; evaluation of 1,600 sq ft unit in progress.",
  },
  {
    type: "Sell",
    customerName: "Anita Desai",
    mobile: "9820445566",
    source: "Website",
    status: "In Progress",
    priority: "High",
    assignedTo: "emp-priyanka",
    ageHours: 7,
    value: 640_000,
    vehicle: "Maruti Suzuki Baleno Zeta 2022",
    summary: "Inspection scheduled at Powai; AI estimate ₹6.1–6.7L, owner expects ₹6.9L.",
  },
  {
    type: "Sell",
    customerName: "Suresh Kumar",
    mobile: "9740098877",
    source: "WhatsApp",
    status: "New",
    priority: "Medium",
    assignedTo: null,
    ageHours: 20,
    value: 920_000,
    vehicle: "Tata Nexon XZ+ 2022",
    summary: "Photos uploaded, awaiting evaluation slot confirmation.",
  },
  {
    type: "Sell",
    customerName: "Kiran Joshi",
    mobile: "9930021144",
    source: "Walk-in",
    status: "Won",
    priority: "Low",
    assignedTo: "emp-priyanka",
    ageHours: 300,
    value: 415_000,
    vehicle: "Hyundai Grand i10 2018",
    summary: "Purchased outright; RC transfer initiated.",
  },
  {
    type: "Scrap",
    customerName: "Mahesh Gupta",
    mobile: "9818877665",
    source: "Website",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "emp-priyanka",
    ageHours: 13,
    value: 48_000,
    vehicle: "Maruti Suzuki Alto 2009",
    summary: "15-year-old car, RTO deregistration documents collected.",
  },
  {
    type: "Scrap",
    customerName: "Joseph Thomas",
    mobile: "9895012399",
    source: "Phone",
    status: "New",
    priority: "Low",
    assignedTo: null,
    ageHours: 48,
    value: 32_000,
    vehicle: "Hyundai Santro 2007",
    summary: "Pickup requested from Thane; not yet assigned to a yard.",
  },
  {
    type: "Parts Order",
    customerName: "Karan Malhotra",
    mobile: "9821177889",
    source: "Website",
    status: "In Progress",
    priority: "High",
    assignedTo: "emp-priyanka",
    ageHours: 5,
    value: 12_800,
    vehicle: "Honda City VX 2021",
    summary: "Front bumper + left headlamp assembly, order MWP-20431.",
    approvalRequired: true,
  },
  {
    type: "Parts Order",
    customerName: "Divya Rao",
    mobile: "9611056677",
    source: "WhatsApp",
    status: "Won",
    priority: "Low",
    assignedTo: "emp-priyanka",
    ageHours: 96,
    value: 4_300,
    vehicle: "Maruti Suzuki Swift 2020",
    summary: "Air filter and wiper set delivered.",
  },
  {
    type: "Decor Order",
    customerName: "Nikhil Jain",
    mobile: "9765544332",
    source: "Marketplace",
    status: "Awaiting Customer",
    priority: "Medium",
    assignedTo: "emp-priyanka",
    ageHours: 26,
    value: 21_500,
    vehicle: "Toyota Innova Crysta 2019",
    summary: "Custom seat covers quoted, waiting for fabric selection.",
  },
  {
    type: "Decor Order",
    customerName: "Sanya Bhatia",
    mobile: "9812346789",
    source: "Website",
    status: "New",
    priority: "Medium",
    assignedTo: null,
    ageHours: 31,
    value: 15_200,
    vehicle: "Kia Seltos HTX 2022",
    summary: "Ambient lighting package enquiry, unassigned for over a day.",
  },
  {
    type: "Exchange",
    customerName: "Ritu Agarwal",
    mobile: "9930112233",
    source: "Website",
    status: "In Progress",
    priority: "High",
    assignedTo: "emp-priyanka",
    ageHours: 18,
    value: 1_050_000,
    vehicle: "Exchange: Swift 2019 → Creta SX 2023",
    summary: "Exchange quote issued; loan pre-approval running in parallel.",
  },
  {
    type: "Test Drive",
    customerName: "Aditya Kulkarni",
    mobile: "9822334455",
    source: "Marketplace",
    status: "New",
    priority: "Critical",
    assignedTo: null,
    ageHours: 8,
    value: 0,
    vehicle: "Tata Nexon XZ+ 2022",
    summary: "Home test drive requested for Saturday 11:00 in Andheri West.",
  },
  {
    type: "Test Drive",
    customerName: "Shreya Sen",
    mobile: "9773344556",
    source: "Website",
    status: "Won",
    priority: "Low",
    assignedTo: "emp-priyanka",
    ageHours: 130,
    value: 0,
    vehicle: "Hyundai Creta SX 2023",
    summary: "Test drive completed, customer comparing two cars.",
  },
  {
    type: "Vehicle Enquiry",
    customerName: "Manish Tiwari",
    mobile: "9819922110",
    source: "Marketplace",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "emp-priyanka",
    ageHours: 4,
    value: 0,
    vehicle: "Honda City VX 2021",
    summary: "Asked about service history and insurance transfer.",
  },
  {
    type: "Vehicle Enquiry",
    customerName: "Lakshmi Pillai",
    mobile: "9701122334",
    source: "WhatsApp",
    status: "New",
    priority: "Medium",
    assignedTo: null,
    ageHours: 22,
    value: 0,
    vehicle: "Bajaj Pulsar NS200 2021",
    summary: "Wants finance eligibility before committing to a visit.",
  },
];

/* --------------------------------------------------------------- helpers */

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function dueFrom(createdAt: string, type: CaseType): string {
  return new Date(Date.parse(createdAt) + SLA_HOURS[type] * HOUR).toISOString();
}

/* ---------------------------------------------------------------- imports */

const LEAD_TYPE_MAP: Record<LeadType, CaseType> = {
  finance_enquiry: "Finance",
  insurance_enquiry: "Insurance",
  warranty_enquiry: "Insurance",
  service_booking: "Service",
  franchise_enquiry: "Franchise",
  sell_car: "Sell",
  sell_vehicle: "Sell",
  exchange_car: "Exchange",
  exchange_vehicle: "Exchange",
  scrap_vehicle: "Scrap",
  parts_enquiry: "Parts Order",
  decor_order: "Decor Order",
  decor_fitter: "Decor Order",
  decor_partner: "Decor Order",
  test_drive: "Test Drive",
  listing_enquiry: "Vehicle Enquiry",
  listing_offer: "Vehicle Enquiry",
  listing_report: "Vehicle Enquiry",
  whatsapp_click: "Vehicle Enquiry",
  call_click: "Vehicle Enquiry",
  general_enquiry: "Vehicle Enquiry",
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp_click: "WhatsApp",
  call_click: "Phone",
  listing_offer: "Marketplace",
  listing_enquiry: "Marketplace",
};

function leadToCase(lead: Lead, index: number): CrmCase {
  const type = LEAD_TYPE_MAP[lead.type] ?? "Vehicle Enquiry";
  const fields = lead.fields ?? {};
  const reference = fields["referenceId"] ?? fields["trackingId"] ?? fields["applicationId"];
  const name = lead.name?.trim() || "Website visitor";
  const createdAt = lead.createdAt || new Date().toISOString();
  const summaryBits = [
    lead.vehicleName,
    fields["category"],
    fields["policyType"],
    fields["serviceType"],
    fields["franchiseType"],
    reference ? `Ref ${reference}` : "",
  ].filter((bit): bit is string => Boolean(bit));

  return {
    id: `MWC-${String(3100 + index)}`,
    type,
    customerName: name,
    mobile: lead.mobile?.trim() || "—",
    email: null,
    source: SOURCE_LABEL[lead.type] ?? lead.source ?? "Website",
    status: "New",
    priority: type === "Service" || type === "Finance" ? "High" : "Medium",
    assignedTo: null,
    createdAt,
    updatedAt: createdAt,
    dueAt: dueFrom(createdAt, type),
    value: 0,
    vehicle: lead.vehicleName?.trim() || null,
    summary: summaryBits.join(" · ") || "Submitted through the website lead queue.",
    approvalRequired: type === "Finance",
    notes: [],
    events: [
      {
        id: `evt-${slug(createdAt)}-import`,
        at: createdAt,
        by: "Lead queue",
        label: "Imported from site lead capture",
      },
    ],
    origin: "imported",
    sourceKey: `lead:${lead.type}:${createdAt}`,
  };
}

function seedCases(now: number): CrmCase[] {
  return SEED_ROWS.map((row, index) => {
    const createdAt = new Date(now - row.ageHours * HOUR).toISOString();
    const id = `MWC-${String(1001 + index)}`;
    return {
      id,
      type: row.type,
      customerName: row.customerName,
      mobile: row.mobile,
      email: row.email ?? null,
      source: row.source,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assignedTo,
      createdAt,
      updatedAt: createdAt,
      dueAt: dueFrom(createdAt, row.type),
      value: row.value,
      vehicle: row.vehicle ?? null,
      summary: row.summary,
      approvalRequired: row.approvalRequired ?? false,
      notes: (row.notes ?? []).map((text, noteIndex) => ({
        id: `note-${id}-${noteIndex}`,
        at: new Date(Date.parse(createdAt) + HOUR).toISOString(),
        by: "Ananya Rao",
        text,
      })),
      events: [{ id: `evt-${id}-created`, at: createdAt, by: row.source, label: "Case created" }],
      origin: "demo" as const,
      sourceKey: `seed:${id}`,
    };
  });
}

/* --------------------------------------------------------------- reading */

export type CrmSnapshot = {
  cases: CrmCase[];
  employees: AdminEmployee[];
  activity: ActivityEntry[];
};

const EMPTY: CrmSnapshot = { cases: [], employees: [], activity: [] };

function readSnapshot(): CrmSnapshot {
  if (typeof window === "undefined") return EMPTY;
  return {
    cases: readJson<CrmCase[]>(CASES_KEY, []),
    employees: readJson<AdminEmployee[]>(EMPLOYEES_KEY, []),
    activity: readJson<ActivityEntry[]>(ACTIVITY_KEY, []),
  };
}

/**
 * Seeds the admin database once, then keeps importing any new lead the public
 * site captured since the last load. Idempotent: cases are matched on
 * `sourceKey`, so reopening the panel never duplicates a record.
 */
export function ensureAdminDatabase(): CrmSnapshot {
  if (typeof window === "undefined") return EMPTY;

  const existing = readSnapshot();
  const employees = existing.employees.length ? existing.employees : DEMO_EMPLOYEES;
  if (!existing.employees.length) writeJson(EMPLOYEES_KEY, employees);

  let cases = existing.cases.length ? existing.cases : seedCases(Date.now());
  const seeded = window.localStorage.getItem(SEED_FLAG_KEY) === "1";
  if (!existing.cases.length) writeJson(SEED_FLAG_KEY, "1");

  // Pull in leads the site collected, without touching cases imported before.
  const known = new Set(cases.map((item) => item.sourceKey));
  let imported = 0;
  for (const [index, lead] of readLeadQueue().entries()) {
    const candidate = leadToCase(lead, index);
    if (known.has(candidate.sourceKey)) continue;
    known.add(candidate.sourceKey);
    cases = [candidate, ...cases];
    imported += 1;
  }

  if (!existing.cases.length || imported > 0) writeJson(CASES_KEY, cases);

  if (!seeded && !existing.activity.length) {
    const now = Date.now();
    const startActivity: ActivityEntry[] = cases.slice(0, 6).map((item, index) => ({
      id: `act-seed-${index}`,
      at: new Date(now - (index * 37 + 12) * 60 * 1000).toISOString(),
      actor: index % 2 === 0 ? "Ananya Rao" : "Priyanka Shah",
      action: index % 2 === 0 ? "reviewed" : "updated",
      detail: `${item.type} case for ${item.customerName}`,
      caseId: item.id,
    }));
    writeJson(ACTIVITY_KEY, startActivity);
  }

  return readSnapshot();
}

/* -------------------------------------------------------------- mutations */

const listeners = new Set<() => void>();

function commit(
  cases: CrmCase[],
  activity: ActivityEntry[],
  entry: Omit<ActivityEntry, "id" | "at">,
) {
  writeJson(CASES_KEY, cases);
  const next: ActivityEntry = {
    ...entry,
    id: uniqueId("act"),
    at: new Date().toISOString(),
  };
  writeJson(ACTIVITY_KEY, [next, ...activity].slice(0, 80));
  listeners.forEach((listener) => listener());
}

export function subscribeToAdminData(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === CASES_KEY || event.key === ACTIVITY_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function withCase(
  id: string,
  actor: string,
  mutate: (item: CrmCase) => CrmCase,
  activity: { action: string; detail: string },
): boolean {
  const snapshot = ensureAdminDatabase();
  const index = snapshot.cases.findIndex((item) => item.id === id);
  if (index === -1) return false;
  const current = snapshot.cases[index]!;
  const updated = mutate(current);
  const cases = [...snapshot.cases];
  cases[index] = updated;
  commit(cases, snapshot.activity, { ...activity, actor, caseId: id });
  return true;
}

export function updateCaseStatus(
  id: string,
  status: CaseStatus,
  actor: string,
): { ok: boolean; error?: string } {
  let changed = false;
  const done = withCase(
    id,
    actor,
    (item) => {
      if (item.status === status) return item;
      changed = true;
      return {
        ...item,
        status,
        updatedAt: new Date().toISOString(),
        events: [
          ...item.events,
          {
            id: uniqueId("evt"),
            at: new Date().toISOString(),
            by: actor,
            label: `Status ${item.status} → ${status}`,
          },
        ],
      };
    },
    { action: "updated status", detail: "" },
  );
  if (!done) return { ok: false, error: "That case no longer exists." };
  return changed ? { ok: true } : { ok: false, error: "That status is already set." };
}

export function assignCase(
  id: string,
  employeeId: string | null,
  actor: string,
): { ok: boolean; error?: string } {
  const employees = ensureAdminDatabase().employees;
  const employee = employeeId ? employees.find((item) => item.id === employeeId) : null;
  if (employeeId && !employee) return { ok: false, error: "Unknown employee." };

  const done = withCase(
    id,
    actor,
    (item) => ({
      ...item,
      assignedTo: employee ? employee.id : null,
      updatedAt: new Date().toISOString(),
      events: [
        ...item.events,
        {
          id: uniqueId("evt"),
          at: new Date().toISOString(),
          by: actor,
          label: employee ? `Assigned to ${employee.name}` : "Unassigned",
        },
      ],
    }),
    {
      action: employee ? "assigned" : "unassigned",
      detail: `${id} → ${employee?.name ?? "unassigned"}`,
    },
  );
  return done ? { ok: true } : { ok: false, error: "That case no longer exists." };
}

export function addCaseNote(
  id: string,
  text: string,
  actor: string,
): { ok: boolean; error?: string } {
  const note = text.trim().replace(/\s+/g, " ");
  if (note.length < 2) return { ok: false, error: "Write a note before saving." };
  const done = withCase(
    id,
    actor,
    (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
      notes: [
        ...item.notes,
        { id: uniqueId("note"), at: new Date().toISOString(), by: actor, text: note },
      ],
      events: [
        ...item.events,
        { id: uniqueId("evt"), at: new Date().toISOString(), by: actor, label: "Note added" },
      ],
    }),
    { action: "added a note to", detail: note.slice(0, 80) },
  );
  return done ? { ok: true } : { ok: false, error: "That case no longer exists." };
}

/* -------------------------------------------------------------------- SLA */

export function slaFor(item: CrmCase, now = Date.now()): SlaInfo {
  const due = Date.parse(item.dueAt);
  const created = Date.parse(item.createdAt);
  if (!Number.isFinite(due)) return { state: "On track", label: "No SLA", hoursLeft: 0 };
  const hoursLeft = (due - now) / HOUR;

  if (isResolvedStatus(item.status)) {
    const resolvedAt = Date.parse(item.updatedAt);
    const late = Number.isFinite(resolvedAt) && resolvedAt > due;
    return late
      ? { state: "Breached", label: "Breached", hoursLeft: 0 }
      : { state: "Met", label: "Met", hoursLeft: 0 };
  }

  if (hoursLeft < 0) {
    const overdue = Math.abs(hoursLeft);
    return {
      state: "Overdue",
      label:
        overdue >= 48
          ? `Overdue ${Math.round(overdue / 24)}d`
          : overdue < 1
            ? `Overdue ${Math.max(1, Math.round(overdue * 60))}m`
            : `Overdue ${Math.round(overdue)}h`,
      hoursLeft,
    };
  }

  const window_ = Math.max(HOUR, due - created);
  const share = (hoursLeft * HOUR) / window_;
  return share <= 0.25
    ? {
        state: "Due soon",
        label: `Due in ${hoursLeft < 1 ? `${Math.round(hoursLeft * 60)}m` : `${Math.round(hoursLeft)}h`}`,
        hoursLeft,
      }
    : {
        state: "On track",
        label: `Due in ${hoursLeft >= 48 ? `${Math.round(hoursLeft / 24)}d` : `${Math.round(hoursLeft)}h`}`,
        hoursLeft,
      };
}

/* ------------------------------------------------------------------- KPIs */

export type AdminKpis = {
  revenue: number;
  revenueWon: number;
  leads: number;
  pendingApprovals: number;
  activeUsers: number;
  overdue: number;
  openCases: number;
  unassigned: number;
  wonRate: number;
};

export function adminKpis(cases: CrmCase[], now = Date.now()): AdminKpis {
  const monthAgo = now - 30 * 24 * HOUR;
  const won = cases.filter((item) => item.status === "Won");
  const resolved = cases.filter((item) => isResolvedStatus(item.status));
  const activeMobiles = new Set(
    cases.filter((item) => Date.parse(item.updatedAt) >= monthAgo).map((item) => item.mobile),
  );
  const open = cases.filter((item) => isOpenStatus(item.status));

  return {
    revenue: won.reduce((sum, item) => sum + item.value, 0),
    revenueWon: won.length,
    leads: cases.length,
    pendingApprovals: cases.filter(
      (item) =>
        item.status === "Awaiting Approval" || (item.approvalRequired && isOpenStatus(item.status)),
    ).length,
    activeUsers: activeMobiles.size,
    overdue: open.filter((item) => slaFor(item, now).state === "Overdue").length,
    openCases: open.length,
    unassigned: open.filter((item) => !item.assignedTo).length,
    wonRate: resolved.length ? Math.round((won.length / resolved.length) * 100) : 0,
  };
}

export function actionRequired(cases: CrmCase[], now = Date.now()): CrmCase[] {
  return cases
    .filter((item) => isOpenStatus(item.status))
    .map((item) => ({ item, sla: slaFor(item, now) }))
    .filter(({ sla }) => sla.state === "Overdue" || sla.state === "Due soon")
    .sort((a, b) => a.sla.hoursLeft - b.sla.hoursLeft)
    .slice(0, 6)
    .map(({ item }) => item);
}

export function recentActivity(activity: ActivityEntry[], limit = 8): ActivityEntry[] {
  return [...activity].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

export function typeBreakdown(cases: CrmCase[]): { type: CaseType; count: number; open: number }[] {
  return CASE_TYPES.map((type) => {
    const rows = cases.filter((item) => item.type === type);
    return {
      type,
      count: rows.length,
      open: rows.filter((item) => isOpenStatus(item.status)).length,
    };
  }).filter((row) => row.count > 0);
}

export function statusBreakdown(cases: CrmCase[]): { status: CaseStatus; count: number }[] {
  return CASE_STATUSES.map((status) => ({
    status,
    count: cases.filter((item) => item.status === status).length,
  })).filter((row) => row.count > 0);
}

/* ------------------------------------------------------------------ format */

export const inr = (value: number) =>
  value >= 10_000_000
    ? `₹${(value / 10_000_000).toFixed(2)} Cr`
    : value >= 100_000
      ? `₹${(value / 100_000).toFixed(2)} L`
      : `₹${value.toLocaleString("en-IN")}`;

export const shortDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
};

export const relativeTime = (iso: string, now = Date.now()) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(iso);
};

export function employeeName(employees: AdminEmployee[], id: string | null): string | null {
  if (!id) return null;
  return employees.find((item) => item.id === id)?.name ?? null;
}
