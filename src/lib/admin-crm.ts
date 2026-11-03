import { replicaRead, replicaWrite } from "@/lib/cloud-store";

/**
 * Master Tracker data — one table for every business case.
 *
 * Every flow on the site already funnels through `submitLead()` into the local
 * lead queue. This module turns those records into CRM cases, adds the demo
 * pipeline the control room needs on day one, and persists all edits (status,
 * assignment, notes, history) in the admin database.
 *
 * Persistence goes through src/lib/cloud-store.ts, so the case table is stored
 * in Supabase and replicated on device for synchronous rendering.
 *
 * Access control lives in this file too: every mutation takes the acting
 * `Actor`, re-checks the role and department policy, refuses the write when the
 * policy says no, and records both the allowed and the refused attempts in the
 * audit log. Hiding a button in the UI is never the only defence.
 */
import { readLeadQueue, type Lead, type LeadType } from "./leads";
import {
  DEPARTMENTS,
  ROLES,
  ROLE_LABEL,
  can,
  canAssignCase,
  canEditCase,
  canViewCase,
  departmentCovers,
  departmentForCaseType,
  isSuperAdmin,
  type Actor,
  type Department,
  type Role,
} from "./admin-rbac";
import {
  createPasswordCredential,
  validatePasswordStrength,
  verifyPasswordCredential,
} from "./admin-crypto";

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

export type EmployeeStatus = "Active" | "Disabled";

export type AdminEmployee = {
  /** Human-facing unique id, e.g. EMP-1001. */
  id: string;
  name: string;
  email: string;
  mobile: string;
  department: Department;
  role: Role;
  status: EmployeeStatus;
  createdAt: string;
  lastLoginAt: string | null;
  /** Salted PBKDF2 credential; the plaintext password is never stored. */
  credential: { salt: string; hash: string; iterations: number } | null;
};

/** Actions worth recording. Everything that changes access or a case is here. */
export const AUDIT_ACTIONS = [
  "case.status",
  "case.assign",
  "case.note",
  "case.denied",
  "employee.create",
  "employee.update",
  "employee.disable",
  "employee.enable",
  "employee.password",
  "auth.sign_in",
  "access.denied",
  "case.priority",
  "rule.create",
  "rule.update",
  "rule.toggle",
  "rule.delete",
  "rule.run",
  "automation.denied",
  "reconcile.run",
  "reconcile.repair",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_CATEGORY: Record<AuditAction, string> = {
  "case.status": "Case status",
  "case.assign": "Assignment",
  "case.note": "Case note",
  "case.denied": "Refused change",
  "employee.create": "Employee added",
  "employee.update": "Employee edited",
  "employee.disable": "Employee disabled",
  "employee.enable": "Employee enabled",
  "employee.password": "Password reset",
  "auth.sign_in": "Sign in",
  "access.denied": "Access refused",
  "case.priority": "Priority change",
  "rule.create": "Rule created",
  "rule.update": "Rule edited",
  "rule.toggle": "Rule switched",
  "rule.delete": "Rule deleted",
  "rule.run": "Automation run",
  "automation.denied": "Automation refused",
  "reconcile.run": "Reconciliation",
  "reconcile.repair": "Gap repaired",
};

export type AuditEntry = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  /** Case id, employee id or "—". */
  target: string;
  /** Reads like “assigned MWC-1001 to Priyanka Shah (EMP-1004)”. */
  summary: string;
  department: Department | null;
  outcome: "allowed" | "denied";
};

export type SlaState = "On track" | "Due soon" | "Overdue" | "Met" | "Breached";

export type SlaInfo = { state: SlaState; label: string; hoursLeft: number };

/* -------------------------------------------------------------- key names */

const CASES_KEY = "mw_admin_cases_v1";
const EMPLOYEES_KEY = "mw_admin_employees_v2";
const LEGACY_EMPLOYEES_KEY = "mw_admin_employees_v1";
const AUDIT_KEY = "mw_admin_audit_v1";
const LEGACY_ACTIVITY_KEY = "mw_admin_activity_v1";
const SEED_FLAG_KEY = "mw_admin_seeded_v1";
const JOURNAL_KEY = "mw_admin_case_journal_v1";

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

/**
 * Every CRM collection (cases, employees, audit trail) now lives in Supabase
 * `app_records`; the on-device replica keeps the panel rendering synchronously.
 */
function readJson<T>(key: string, fallback: T): T {
  return replicaRead<T>(key, fallback);
}

function writeJson(key: string, value: unknown): boolean {
  // A blocked write still leaves the panel rendering its in-memory state.
  return replicaWrite(key, value);
}

/* ------------------------------------------------------------- seed data */

const DEMO_EMPLOYEES: AdminEmployee[] = [
  {
    id: "EMP-1001",
    name: "Ananya Rao",
    email: "ananya.rao@motorwallah.in",
    mobile: "9820011201",
    department: "Finance",
    role: "manager",
    status: "Active",
    createdAt: "2025-11-02T09:00:00.000Z",
    lastLoginAt: null,
    credential: null,
  },
  {
    id: "EMP-1002",
    name: "Vikram Shetty",
    email: "vikram.shetty@motorwallah.in",
    mobile: "9820011202",
    department: "Insurance",
    role: "executive",
    status: "Active",
    createdAt: "2025-11-02T09:05:00.000Z",
    lastLoginAt: null,
    credential: null,
  },
  {
    id: "EMP-1003",
    name: "Rahul Menon",
    email: "rahul.menon@motorwallah.in",
    mobile: "9820011203",
    department: "Service",
    role: "manager",
    status: "Active",
    createdAt: "2025-11-02T09:10:00.000Z",
    lastLoginAt: null,
    credential: null,
  },
  {
    id: "EMP-1004",
    name: "Priyanka Shah",
    email: "priyanka.shah@motorwallah.in",
    mobile: "9820011204",
    department: "Sales",
    role: "executive",
    status: "Active",
    createdAt: "2025-11-02T09:15:00.000Z",
    lastLoginAt: null,
    credential: null,
  },
  {
    id: "EMP-1005",
    name: "Aakash Verma",
    email: "aakash.verma@motorwallah.in",
    mobile: "9820011205",
    department: "Operations",
    role: "manager",
    status: "Active",
    createdAt: "2025-11-02T09:20:00.000Z",
    lastLoginAt: null,
    credential: null,
  },
];

/** Ids used before the directory existed, kept so old records keep their owner. */
const LEGACY_EMPLOYEE_IDS: Record<string, string> = {
  "emp-ananya": "EMP-1001",
  "emp-vikram": "EMP-1002",
  "emp-rahul": "EMP-1003",
  "emp-priyanka": "EMP-1004",
  "emp-aakash": "EMP-1005",
};

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
    assignedTo: "EMP-1001",
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
    assignedTo: "EMP-1001",
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
    assignedTo: "EMP-1001",
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
    assignedTo: "EMP-1002",
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
    assignedTo: "EMP-1002",
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
    assignedTo: "EMP-1003",
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
    assignedTo: "EMP-1003",
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
    assignedTo: "EMP-1003",
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
    assignedTo: "EMP-1005",
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
    assignedTo: "EMP-1005",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
    assignedTo: "EMP-1004",
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
  audit: AuditEntry[];
};

const EMPTY: CrmSnapshot = { cases: [], employees: [], audit: [] };

function readSnapshot(): CrmSnapshot {
  if (typeof window === "undefined") return EMPTY;
  return {
    cases: readJson<CrmCase[]>(CASES_KEY, []),
    employees: readJson<AdminEmployee[]>(EMPLOYEES_KEY, []),
    audit: readJson<AuditEntry[]>(AUDIT_KEY, []),
  };
}

/* ------------------------------------------------------------- migration */

type LegacyEmployee = {
  id?: string;
  name?: string;
  role?: string;
  desk?: string;
  mobile?: string;
  email?: string;
};

/**
 * Upgrades the Phase 1 team list (name / role text / desk) into the employee
 * directory. Ids are preserved so existing case assignments keep their owner.
 */
function migrateEmployees(): AdminEmployee[] {
  const current = readJson<AdminEmployee[]>(EMPLOYEES_KEY, []);
  const compatible =
    current.length > 0 &&
    current.every(
      (item) => typeof item.department === "string" && ROLES.includes(item.role as Role),
    );
  if (compatible) {
    return current.map((item) => ({
      ...item,
      status: item.status ?? "Active",
      credential: item.credential ?? null,
      lastLoginAt: item.lastLoginAt ?? null,
    }));
  }

  const legacy = readJson<LegacyEmployee[]>(LEGACY_EMPLOYEES_KEY, []);
  const migrated = legacy.length
    ? legacy.map((row, index) => {
        const seed =
          DEMO_EMPLOYEES.find((item) => item.name === row.name) ??
          DEMO_EMPLOYEES[Math.min(index, DEMO_EMPLOYEES.length - 1)]!;
        return {
          ...seed,
          id: LEGACY_EMPLOYEE_IDS[row.id ?? ""] ?? seed.id,
          name: row.name ?? seed.name,
          email: (row.email ?? seed.email).toLowerCase(),
          mobile: row.mobile ?? seed.mobile,
        };
      })
    : [...DEMO_EMPLOYEES];

  const unique = new Map(migrated.map((item) => [item.id, item]));
  writeJson(EMPLOYEES_KEY, [...unique.values()]);
  return [...unique.values()];
}

/** Rewrites the Phase 1 employee ids on cases so nothing is orphaned. */
function remapLegacyAssignments(cases: CrmCase[]): CrmCase[] {
  return cases.map((item) =>
    item.assignedTo && LEGACY_EMPLOYEE_IDS[item.assignedTo]
      ? { ...item, assignedTo: LEGACY_EMPLOYEE_IDS[item.assignedTo]! }
      : item,
  );
}

/**
 * Seeds the admin database once, then keeps importing any new lead the public
 * site captured since the last load. Idempotent: cases are matched on
 * `sourceKey`, so reopening the panel never duplicates a record.
 */
export function ensureAdminDatabase(): CrmSnapshot {
  if (typeof window === "undefined") return EMPTY;

  const existing = readSnapshot();
  const employees = migrateEmployees();
  const knownEmployees = new Set(employees.map((item) => item.id));

  let cases = existing.cases.length
    ? remapLegacyAssignments(existing.cases)
    : seedCases(Date.now());
  // A case assigned to someone who was deleted belongs back in the open queue.
  cases = cases.map((item) =>
    item.assignedTo && !knownEmployees.has(item.assignedTo) ? { ...item, assignedTo: null } : item,
  );

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

  if (!existing.audit.length) {
    const legacy = readJson<
      {
        id?: string;
        at?: string;
        actor?: string;
        action?: string;
        detail?: string;
        caseId?: string | null;
      }[]
    >(LEGACY_ACTIVITY_KEY, []);
    const migrated = legacy
      .filter((entry) => entry.at && entry.actor)
      .map<AuditEntry>((entry, index) => ({
        id: entry.id ?? `aud-legacy-${index}`,
        at: entry.at as string,
        actorId: "OWNER-1",
        actorName: entry.actor as string,
        actorRole: "super_admin",
        action: "case.note",
        target: entry.caseId ?? "—",
        summary: `${entry.action ?? "updated"} ${entry.caseId ?? "a case"}${
          entry.detail ? ` — ${entry.detail}` : ""
        }`,
        department: null,
        outcome: "allowed",
      }));
    writeJson(AUDIT_KEY, migrated.length ? migrated.slice(0, 20) : seedAudit(cases));
  }

  return readSnapshot();
}

function seedAudit(cases: CrmCase[]): AuditEntry[] {
  const now = Date.now();
  return cases.slice(0, 6).map((item, index) => ({
    id: `aud-seed-${index}`,
    at: new Date(now - (index * 37 + 12) * 60 * 1000).toISOString(),
    actorId: index % 2 === 0 ? "EMP-1001" : "EMP-1004",
    actorName: index % 2 === 0 ? "Ananya Rao" : "Priyanka Shah",
    actorRole: index % 2 === 0 ? "manager" : "executive",
    action: index % 2 === 0 ? "case.status" : "case.note",
    target: item.id,
    summary:
      index % 2 === 0
        ? `reviewed status of ${item.id} (${item.type} case for ${item.customerName})`
        : `added a note to ${item.id} (${item.type} case for ${item.customerName})`,
    department: departmentForCaseType(item.type),
    outcome: "allowed" as const,
  }));
}

/* -------------------------------------------------------------- mutations */

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToAdminData(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      event.key === CASES_KEY ||
      event.key === AUDIT_KEY ||
      event.key === EMPLOYEES_KEY
    ) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readAudit(): AuditEntry[] {
  return readJson<AuditEntry[]>(AUDIT_KEY, []);
}

/** Appends one immutable audit entry. Never throws, never blocks a write. */
function record(entry: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const next: AuditEntry = { ...entry, id: uniqueId("aud"), at: new Date().toISOString() };
  writeJson(AUDIT_KEY, [next, ...readAudit()].slice(0, 500));
  return next;
}

function auditActor(actor: Actor) {
  return { actorId: actor.id, actorName: actor.name, actorRole: actor.role };
}

/**
 * Write-ahead journal for case saves.
 *
 * Every case write is journalled before the table is replaced, and the entry is
 * cleared only after the write reports success. A save that never landed — full
 * storage, a closed tab mid-write — therefore leaves a pending entry behind,
 * which the reconciliation check finds and replays instead of losing the case.
 */
export type CaseWriteJournalEntry = {
  id: string;
  at: string;
  caseId: string;
  /** The exact record the write intended to persist. */
  case: CrmCase;
};

export function readCaseJournal(): CaseWriteJournalEntry[] {
  return readJson<CaseWriteJournalEntry[]>(JOURNAL_KEY, []);
}

/** Drops a replayed entry once the case is safely stored. */
export function clearCaseJournalEntry(id: string): void {
  writeJson(
    JOURNAL_KEY,
    readCaseJournal().filter((entry) => entry.id !== id),
  );
}

function saveCases(cases: CrmCase[], attempted?: CrmCase): void {
  if (!attempted) {
    writeJson(CASES_KEY, cases);
    return;
  }
  const entry: CaseWriteJournalEntry = {
    id: uniqueId("jrnl"),
    at: new Date().toISOString(),
    caseId: attempted.id,
    case: attempted,
  };
  writeJson(JOURNAL_KEY, [entry, ...readCaseJournal()].slice(0, 40));
  const stored = writeJson(CASES_KEY, cases);
  if (stored) {
    writeJson(
      JOURNAL_KEY,
      readCaseJournal().filter((item) => item.id !== entry.id),
    );
  }
}

/**
 * Re-applies a journalled save whose write never landed. Used by the
 * reconciliation check, never by the normal edit path.
 */
export function replayCaseWrite(entry: CaseWriteJournalEntry): { ok: boolean; error?: string } {
  const snapshot = readSnapshot();
  const exists = snapshot.cases.some((item) => item.id === entry.caseId);
  const next = exists
    ? snapshot.cases.map((item) => (item.id === entry.caseId ? entry.case : item))
    : [entry.case, ...snapshot.cases];
  const stored = writeJson(CASES_KEY, next);
  if (!stored) return { ok: false, error: "Storage is still refusing writes." };
  clearCaseJournalEntry(entry.id);
  notify();
  return { ok: true };
}

/** Public audit sink so automation and reconciliation log like every other actor. */
export function logAudit(entry: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const written = record(entry);
  notify();
  return written;
}

/**
 * The single write gate for a case. Returns the refusal message, or null when
 * the actor is allowed to perform this kind of change.
 */
function caseDenial(
  actor: Actor,
  item: CrmCase,
  intent: "status" | "assign" | "note",
): string | null {
  if (!canViewCase(actor, item)) {
    const desk = departmentForCaseType(item.type) ?? "another";
    return `This case belongs to the ${desk} desk, outside your access.`;
  }
  if (intent === "assign") {
    if (!can(actor, "case.assign")) {
      return `Your role (${ROLE_LABEL[actor.role]}) cannot assign cases.`;
    }
    return null;
  }
  if (!can(actor, intent === "note" ? "case.note" : "case.update_status")) {
    return `Your role (${ROLE_LABEL[actor.role]}) has read-only access to cases.`;
  }
  if (actor.role === "executive" && item.assignedTo !== actor.id) {
    return "Only the assigned executive or a manager can change this case.";
  }
  return null;
}

function denyCaseWrite(
  actor: Actor,
  item: CrmCase,
  attempted: string,
  reason: string,
): { ok: false; error: string } {
  record({
    ...auditActor(actor),
    action: "case.denied",
    target: item.id,
    summary: `attempted to ${attempted} ${item.id} — refused: ${reason}`,
    department: departmentForCaseType(item.type),
    outcome: "denied",
  });
  notify();
  return { ok: false, error: reason };
}

export function updateCaseStatus(
  id: string,
  status: CaseStatus,
  actor: Actor,
): { ok: boolean; error?: string } {
  const snapshot = ensureAdminDatabase();
  const current = snapshot.cases.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That case no longer exists." };

  const denial = caseDenial(actor, current, "status");
  if (denial) return denyCaseWrite(actor, current, "update", denial);

  if (current.status === status) return { ok: false, error: "That status is already set." };

  const updated: CrmCase = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
    events: [
      ...current.events,
      {
        id: uniqueId("evt"),
        at: new Date().toISOString(),
        by: actor.name,
        label: `Status ${current.status} → ${status}`,
      },
    ],
  };
  saveCases(
    snapshot.cases.map((item) => (item.id === id ? updated : item)),
    updated,
  );
  record({
    ...auditActor(actor),
    action: "case.status",
    target: id,
    summary: `changed status of ${id} from ${current.status} to ${status}`,
    department: departmentForCaseType(current.type),
    outcome: "allowed",
  });
  notify();
  return { ok: true };
}

export function assignCase(
  id: string,
  employeeId: string | null,
  actor: Actor,
): { ok: boolean; error?: string } {
  const snapshot = ensureAdminDatabase();
  const current = snapshot.cases.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That case no longer exists." };

  const denial = caseDenial(actor, current, "assign");
  if (denial) return denyCaseWrite(actor, current, "assign", denial);

  const employee = employeeId
    ? (snapshot.employees.find((item) => item.id === employeeId) ?? null)
    : null;
  if (employeeId && !employee) return { ok: false, error: "Unknown employee." };
  if (employee) {
    if (employee.status !== "Active") {
      return denyCaseWrite(
        actor,
        current,
        "assign",
        `${employee.name} is disabled and cannot take new work.`,
      );
    }
    const fitsDesk =
      employee.role === "super_admin" || departmentCovers(employee.department, current.type);
    if (!fitsDesk) {
      return denyCaseWrite(
        actor,
        current,
        "assign",
        `${employee.name} works in ${employee.department} and cannot take a ${current.type} case.`,
      );
    }
  }

  const updated: CrmCase = {
    ...current,
    assignedTo: employee ? employee.id : null,
    updatedAt: new Date().toISOString(),
    events: [
      ...current.events,
      {
        id: uniqueId("evt"),
        at: new Date().toISOString(),
        by: actor.name,
        label: employee ? `Assigned to ${employee.name} (${employee.id})` : "Unassigned",
      },
    ],
  };
  saveCases(
    snapshot.cases.map((item) => (item.id === id ? updated : item)),
    updated,
  );
  record({
    ...auditActor(actor),
    action: "case.assign",
    target: id,
    summary: employee
      ? `assigned ${id} to ${employee.name} (${employee.id})`
      : `moved ${id} back to the unassigned queue`,
    department: departmentForCaseType(current.type),
    outcome: "allowed",
  });
  notify();
  return { ok: true };
}

export function addCaseNote(
  id: string,
  text: string,
  actor: Actor,
): { ok: boolean; error?: string } {
  const note = text.trim().replace(/\s+/g, " ");
  if (note.length < 2) return { ok: false, error: "Write a note before saving." };

  const snapshot = ensureAdminDatabase();
  const current = snapshot.cases.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That case no longer exists." };

  const denial = caseDenial(actor, current, "note");
  if (denial) return denyCaseWrite(actor, current, "add a note to", denial);

  const updated: CrmCase = {
    ...current,
    updatedAt: new Date().toISOString(),
    notes: [
      ...current.notes,
      { id: uniqueId("note"), at: new Date().toISOString(), by: actor.name, text: note },
    ],
    events: [
      ...current.events,
      { id: uniqueId("evt"), at: new Date().toISOString(), by: actor.name, label: "Note added" },
    ],
  };
  saveCases(
    snapshot.cases.map((item) => (item.id === id ? updated : item)),
    updated,
  );
  record({
    ...auditActor(actor),
    action: "case.note",
    target: id,
    summary: `added a note to ${id} — ${note.slice(0, 70)}${note.length > 70 ? "…" : ""}`,
    department: departmentForCaseType(current.type),
    outcome: "allowed",
  });
  notify();
  return { ok: true };
}

/* ------------------------------------------------------------ employees */

/** Priority is a triage decision, so it follows the same gate as a status edit. */
export function setCasePriority(
  id: string,
  priority: CasePriority,
  actor: Actor,
): { ok: boolean; error?: string } {
  const snapshot = ensureAdminDatabase();
  const current = snapshot.cases.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That case no longer exists." };

  const denial = caseDenial(actor, current, "status");
  if (denial) return denyCaseWrite(actor, current, "prioritise", denial);

  if (current.priority === priority) return { ok: false, error: "That priority is already set." };

  const updated: CrmCase = {
    ...current,
    priority,
    updatedAt: new Date().toISOString(),
    events: [
      ...current.events,
      {
        id: uniqueId("evt"),
        at: new Date().toISOString(),
        by: actor.name,
        label: `Priority ${current.priority} → ${priority}`,
      },
    ],
  };
  saveCases(
    snapshot.cases.map((item) => (item.id === id ? updated : item)),
    updated,
  );
  record({
    ...auditActor(actor),
    action: "case.priority",
    target: id,
    summary: `raised the priority of ${id} from ${current.priority} to ${priority}`,
    department: departmentForCaseType(current.type),
    outcome: "allowed",
  });
  notify();
  return { ok: true };
}

/**
 * Imports every lead the public site captured that has not become a case yet.
 * Journalled like any other case write, so a refused write stays recoverable.
 */
export function importQueuedLeads(): { ok: boolean; imported: string[]; error?: string } {
  const snapshot = readSnapshot();
  const known = new Set(snapshot.cases.map((item) => item.sourceKey));
  const created: CrmCase[] = [];
  for (const [index, lead] of readLeadQueue().entries()) {
    const candidate = leadToCase(lead, index);
    if (known.has(candidate.sourceKey)) continue;
    known.add(candidate.sourceKey);
    created.push(candidate);
  }
  if (!created.length) return { ok: true, imported: [] };

  const entries: CaseWriteJournalEntry[] = created.map((item) => ({
    id: uniqueId("jrnl"),
    at: new Date().toISOString(),
    caseId: item.id,
    case: item,
  }));
  writeJson(JOURNAL_KEY, [...entries, ...readCaseJournal()].slice(0, 40));
  const stored = writeJson(CASES_KEY, [...created, ...snapshot.cases]);
  if (!stored) return { ok: false, imported: [], error: "Storage refused the write." };

  const done = new Set(entries.map((entry) => entry.id));
  writeJson(
    JOURNAL_KEY,
    readCaseJournal().filter((entry) => !done.has(entry.id)),
  );
  notify();
  return { ok: true, imported: created.map((item) => item.id) };
}

export type EmployeeInput = {
  name: string;
  email: string;
  mobile: string;
  department: Department;
  role: Role;
  status: EmployeeStatus;
};

export type EmployeeResult = { ok: true; employee: AdminEmployee } | { ok: false; error: string };

export function nextEmployeeId(employees: AdminEmployee[]): string {
  const highest = employees.reduce((acc, item) => {
    const numeric = Number(item.id.replace(/^EMP-/, ""));
    return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
  }, 1000);
  return `EMP-${highest + 1}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Digits only, so 98200 11201 and +91 98200 11201 both work. */
function normalizeMobile(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

function validateEmployee(
  input: EmployeeInput,
  employees: AdminEmployee[],
  editingId?: string,
): string | null {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return "Enter the employee's full name.";
  if (name.length > 60) return "Keep the name under 60 characters.";

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid work email address.";
  const clash = employees.find(
    (item) => item.email.toLowerCase() === email && item.id !== editingId,
  );
  if (clash) return `${clash.name} already uses that email (${clash.id}).`;

  const mobile = normalizeMobile(input.mobile);
  if (!/^[6-9]\d{9}$/.test(mobile)) return "Enter a 10-digit Indian mobile number.";

  if (!DEPARTMENTS.includes(input.department)) return "Choose a department.";
  if (!ROLES.includes(input.role)) return "Choose a role.";
  return null;
}

function employeeDenial(actor: Actor): string | null {
  if (!can(actor, "employee.manage")) {
    return `Your role (${ROLE_LABEL[actor.role]}) can view the directory but not change it.`;
  }
  return null;
}

function recordEmployeeDenial(actor: Actor, summary: string, target = "—") {
  record({
    ...auditActor(actor),
    action: "access.denied",
    target,
    summary,
    department: actor.department,
    outcome: "denied",
  });
  notify();
}

export async function createEmployee(
  input: EmployeeInput & { password: string },
  actor: Actor,
): Promise<EmployeeResult> {
  const denial = employeeDenial(actor);
  if (denial) {
    recordEmployeeDenial(actor, `tried to add an employee — refused: ${denial}`);
    return { ok: false, error: denial };
  }

  const snapshot = ensureAdminDatabase();
  const invalid = validateEmployee(input, snapshot.employees);
  if (invalid) return { ok: false, error: invalid };

  const weak = validatePasswordStrength(input.password);
  if (weak) return { ok: false, error: weak };

  const credential = await createPasswordCredential(input.password);
  const employee: AdminEmployee = {
    id: nextEmployeeId(snapshot.employees),
    name: input.name.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    department: input.department,
    role: input.role,
    status: input.status,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    credential,
  };

  writeJson(EMPLOYEES_KEY, [...snapshot.employees, employee]);
  record({
    ...auditActor(actor),
    action: "employee.create",
    target: employee.id,
    summary: `added ${employee.name} (${employee.id}) to ${employee.department} as ${ROLE_LABEL[employee.role]}`,
    department: employee.department,
    outcome: "allowed",
  });
  notify();
  return { ok: true, employee };
}

export function updateEmployee(id: string, input: EmployeeInput, actor: Actor): EmployeeResult {
  const denial = employeeDenial(actor);
  if (denial) {
    recordEmployeeDenial(actor, `tried to edit ${id} — refused: ${denial}`, id);
    return { ok: false, error: denial };
  }

  const snapshot = ensureAdminDatabase();
  const current = snapshot.employees.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That employee no longer exists." };

  const invalid = validateEmployee(input, snapshot.employees, id);
  if (invalid) return { ok: false, error: invalid };

  if (id === actor.id && (input.role !== current.role || input.department !== current.department)) {
    return { ok: false, error: "You cannot change your own role or department." };
  }

  const employee: AdminEmployee = {
    ...current,
    name: input.name.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    department: input.department,
    role: input.role,
    status: input.status,
  };
  writeJson(
    EMPLOYEES_KEY,
    snapshot.employees.map((item) => (item.id === id ? employee : item)),
  );
  record({
    ...auditActor(actor),
    action: "employee.update",
    target: id,
    summary: `updated ${employee.name} (${id}) — ${employee.department}, ${ROLE_LABEL[employee.role]}`,
    department: employee.department,
    outcome: "allowed",
  });
  notify();
  return { ok: true, employee };
}

export function setEmployeeStatus(
  id: string,
  status: EmployeeStatus,
  actor: Actor,
): EmployeeResult {
  const denial = employeeDenial(actor);
  if (denial) {
    recordEmployeeDenial(
      actor,
      `tried to ${status === "Disabled" ? "disable" : "enable"} ${id} — refused: ${denial}`,
      id,
    );
    return { ok: false, error: denial };
  }
  if (id === actor.id && status === "Disabled") {
    return { ok: false, error: "You cannot disable the account you are signed in with." };
  }

  const snapshot = ensureAdminDatabase();
  const current = snapshot.employees.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That employee no longer exists." };
  if (current.status === status) {
    return { ok: false, error: `${current.name} is already ${status.toLowerCase()}.` };
  }

  const employee: AdminEmployee = { ...current, status };
  writeJson(
    EMPLOYEES_KEY,
    snapshot.employees.map((item) => (item.id === id ? employee : item)),
  );
  record({
    ...auditActor(actor),
    action: status === "Disabled" ? "employee.disable" : "employee.enable",
    target: id,
    summary: `${status === "Disabled" ? "disabled" : "re-enabled"} ${employee.name} (${id})`,
    department: employee.department,
    outcome: "allowed",
  });
  notify();
  return { ok: true, employee };
}

export async function resetEmployeePassword(
  id: string,
  password: string,
  actor: Actor,
): Promise<EmployeeResult> {
  const denial = employeeDenial(actor);
  if (denial) {
    recordEmployeeDenial(actor, `tried to reset the password for ${id} — refused: ${denial}`, id);
    return { ok: false, error: denial };
  }
  const weak = validatePasswordStrength(password);
  if (weak) return { ok: false, error: weak };

  const snapshot = ensureAdminDatabase();
  const current = snapshot.employees.find((item) => item.id === id);
  if (!current) return { ok: false, error: "That employee no longer exists." };

  const credential = await createPasswordCredential(password);
  const employee: AdminEmployee = { ...current, credential };
  writeJson(
    EMPLOYEES_KEY,
    snapshot.employees.map((item) => (item.id === id ? employee : item)),
  );
  record({
    ...auditActor(actor),
    action: "employee.password",
    target: id,
    summary: `reset the password for ${employee.name} (${id})`,
    department: employee.department,
    outcome: "allowed",
  });
  notify();
  return { ok: true, employee };
}

/** Used by the sign-in screen; returns the employee record on success. */
export async function verifyEmployeeSignIn(
  emailInput: string,
  password: string,
): Promise<EmployeeResult> {
  const email = emailInput.trim().toLowerCase();
  const snapshot = ensureAdminDatabase();
  const employee = snapshot.employees.find((item) => item.email.toLowerCase() === email);
  if (!employee || !employee.credential) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const valid = await verifyPasswordCredential(password, employee.credential);
  if (!valid) return { ok: false, error: "Email or password is incorrect." };
  if (employee.status === "Disabled") {
    return {
      ok: false,
      error: "This employee account is disabled. Ask an administrator to re-enable it.",
    };
  }

  const at = new Date().toISOString();
  const next: AdminEmployee = { ...employee, lastLoginAt: at };
  writeJson(
    EMPLOYEES_KEY,
    snapshot.employees.map((item) => (item.id === employee.id ? next : item)),
  );
  record({
    ...auditActor({
      id: next.id,
      name: next.name,
      email: next.email,
      role: next.role,
      department: next.department,
    }),
    action: "auth.sign_in",
    target: next.id,
    summary: `signed in to the control room (${ROLE_LABEL[next.role]}, ${next.department})`,
    department: next.department,
    outcome: "allowed",
  });
  notify();
  return { ok: true, employee: next };
}

/* -------------------------------------------------------------- queries */

export function visibleCases(actor: Actor, cases: CrmCase[]): CrmCase[] {
  return cases.filter((item) => canViewCase(actor, item));
}

export function visibleEmployees(actor: Actor, employees: AdminEmployee[]): AdminEmployee[] {
  if (isSuperAdmin(actor) || can(actor, "employee.view")) return employees;
  return employees.filter((item) => item.department === actor.department);
}

/** Employees the actor may hand this kind of case to. */
export function assignableEmployees(
  actor: Actor,
  employees: AdminEmployee[],
  type: CaseType,
): AdminEmployee[] {
  if (!can(actor, "case.assign")) return [];
  return employees.filter(
    (item) =>
      item.status === "Active" &&
      (item.role === "super_admin" || departmentCovers(item.department, type)),
  );
}

/** Audit entries the actor is allowed to read, newest first. */
export function visibleAudit(actor: Actor, entries: AuditEntry[]): AuditEntry[] {
  const sorted = [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (isSuperAdmin(actor)) return sorted;
  if (can(actor, "audit.view")) {
    return sorted.filter(
      (entry) => entry.department === actor.department || entry.actorId === actor.id,
    );
  }
  return sorted.filter((entry) => entry.actorId === actor.id);
}

export function recentAudit(entries: AuditEntry[], limit = 7): AuditEntry[] {
  return entries.slice(0, limit);
}

export function openCasesFor(cases: CrmCase[], employeeId: string): CrmCase[] {
  return cases.filter((item) => item.assignedTo === employeeId && isOpenStatus(item.status));
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

export function employeeById(employees: AdminEmployee[], id: string | null): AdminEmployee | null {
  if (!id) return null;
  return employees.find((item) => item.id === id) ?? null;
}
