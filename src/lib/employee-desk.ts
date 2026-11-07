import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import {
  addCaseNote,
  ensureAdminDatabase,
  subscribeToAdminData,
  updateCaseStatus,
  type CaseStatus,
  type CaseType,
  type CrmCase,
} from "@/lib/admin-crm";
import { canEditCase, type Actor, type Department } from "@/lib/admin-rbac";

/**
 * Employee desk data — one dataset per department, never mixed.
 *
 * The Universal Employee Dashboard shows a different board for each desk:
 *
 *   sales      Lead Management Table
 *   workshop   Job Card / Repair Status Board
 *   parts      Order Fulfilment Table
 *   finance    Application Tracker
 *   insurance  Application Tracker
 *
 * Scoping rules:
 *   1. `deskForEmployee()` decides which desk an employee may open. It is
 *      derived from the department (and category) the admin assigned — an
 *      employee cannot pick a desk in the UI.
 *   2. Every read goes through `readDesk()`, which returns `null` (not
 *      another desk's rows) when the signed-in person has no desk.
 *   3. Every mutation re-checks the desk *and* the RBAC case policy in
 *      `admin-rbac.ts`, so the guard is at the write, not just in the view.
 *
 * The rows themselves are per-desk collections (`mw_desk_sales_v1`, …), so a
 * browser session only ever loads the collection for its own desk. Records
 * imported from the shared CRM keep their case id, and a status change here is
 * mirrored back into the Master Tracker.
 */

export const DESKS = ["sales", "workshop", "parts", "finance", "insurance"] as const;
export type DeskKey = (typeof DESKS)[number];

export const DESK_DEPARTMENT: Record<DeskKey, Department> = {
  sales: "Sales",
  workshop: "Service",
  parts: "Service",
  finance: "Finance",
  insurance: "Insurance",
};

export const DESK_LABEL: Record<DeskKey, string> = {
  sales: "Vehicle Sales Desk",
  workshop: "Workshop Desk",
  parts: "Parts & Decor Desk",
  finance: "Finance Desk",
  insurance: "Insurance Desk",
};

/** Sub-desk choices the admin picks from. Free text is stored as entered. */
export const DEPARTMENT_CATEGORIES: Record<Department, string[]> = {
  Sales: ["Car Sales", "Bike Sales", "Truck & Commercial", "Used Vehicle Sales"],
  Service: ["Car Workshop", "Bike Workshop", "Parts & Decor", "Body Shop"],
  Finance: ["Vehicle Loans", "Commercial Finance"],
  Insurance: ["Motor Insurance", "Claims"],
  Operations: ["Franchise", "Scrap & Exchange"],
  IT: ["Systems"],
};

export const DESK_SUBTITLE: Record<DeskKey, string> = {
  sales: "Leads, follow-ups and deal progress for every vehicle line.",
  workshop: "Job cards, repair status and mechanic notes from the floor.",
  parts: "Order fulfilment for auto parts and vehicle decor.",
  finance: "Loan files, review stage and lender decisions.",
  insurance: "Policy quotes, renewals and provider decisions.",
};

/** Which CRM business lines belong to each desk. */
export const DESK_CASE_TYPES: Record<DeskKey, CaseType[]> = {
  sales: ["Sell", "Exchange", "Test Drive", "Vehicle Enquiry"],
  workshop: ["Service"],
  parts: ["Parts Order", "Decor Order"],
  finance: ["Finance"],
  insurance: ["Insurance"],
};

/**
 * The desk a person may open, from the department the admin assigned.
 *
 * Service is split by category: a "Parts & Decor" category opens the order
 * board, anything else opens the workshop board.
 */
export function deskForEmployee(
  department: Department,
  category: string | null | undefined,
): DeskKey | null {
  switch (department) {
    case "Sales":
      return "sales";
    case "Finance":
      return "finance";
    case "Insurance":
      return "insurance";
    case "Service":
      return /parts|decor/i.test(category ?? "") ? "parts" : "workshop";
    default:
      return null;
  }
}

/** Human label for the category shown beside the desk name. */
export function categoryLabel(category: string | null | undefined): string | null {
  const value = (category ?? "").trim();
  return value ? value : null;
}

/* --------------------------------------------------------------- statuses */

export const SALES_STATUSES = [
  "New",
  "Contacted",
  "Follow-up",
  "Deal in Process",
  "Deal Closed",
] as const;
export type SalesStatus = (typeof SALES_STATUSES)[number];

export const JOB_STATUSES = [
  "Pending",
  "In Progress",
  "Waiting for Parts",
  "Ready for Delivery",
  "Delivered",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ORDER_STATUSES = ["Pending", "Packed", "Shipped", "Delivered", "Cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const APPLICATION_STATUSES = ["Submitted", "Under Review", "Approved", "Rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Desk status → the Master Tracker status it maps onto (and back). */
const TO_CASE: Record<SalesStatus | JobStatus | OrderStatus | ApplicationStatus, CaseStatus> = {
  New: "New",
  Contacted: "In Progress",
  "Follow-up": "Awaiting Customer",
  "Deal in Process": "Awaiting Approval",
  "Deal Closed": "Won",
  Pending: "New",
  "In Progress": "In Progress",
  "Waiting for Parts": "Awaiting Customer",
  "Ready for Delivery": "Awaiting Approval",
  Delivered: "Won",
  Packed: "In Progress",
  Shipped: "Awaiting Customer",
  Cancelled: "Lost",
  Submitted: "New",
  "Under Review": "In Progress",
  Approved: "Won",
  Rejected: "Lost",
};

function salesStatusFrom(status: CaseStatus): SalesStatus {
  switch (status) {
    case "New":
      return "New";
    case "In Progress":
      return "Contacted";
    case "Awaiting Customer":
      return "Follow-up";
    case "Awaiting Approval":
      return "Deal in Process";
    default:
      return "Deal Closed";
  }
}

function jobStatusFrom(status: CaseStatus): JobStatus {
  switch (status) {
    case "New":
      return "Pending";
    case "In Progress":
      return "In Progress";
    case "Awaiting Customer":
      return "Waiting for Parts";
    case "Awaiting Approval":
      return "Ready for Delivery";
    default:
      return "Delivered";
  }
}

function orderStatusFrom(status: CaseStatus): OrderStatus {
  switch (status) {
    case "New":
      return "Pending";
    case "In Progress":
      return "Packed";
    case "Awaiting Customer":
    case "Awaiting Approval":
      return "Shipped";
    case "Lost":
      return "Cancelled";
    default:
      return "Delivered";
  }
}

function applicationStatusFrom(status: CaseStatus): ApplicationStatus {
  switch (status) {
    case "New":
      return "Submitted";
    case "In Progress":
    case "Awaiting Customer":
    case "Awaiting Approval":
      return "Under Review";
    case "Lost":
      return "Rejected";
    default:
      return "Approved";
  }
}

/* ----------------------------------------------------------------- types */

export type DeskNote = { id: string; at: string; by: string; text: string };

type BaseRow = {
  id: string;
  /** CRM case id when this row came from (or was mirrored to) the Master Tracker. */
  caseId: string | null;
  assignedTo: string | null;
  notes: DeskNote[];
  createdAt: string;
  updatedAt: string;
};

export type SalesLead = BaseRow & {
  kind: "sales";
  customerName: string;
  mobile: string;
  vehicle: string;
  source: string;
  status: SalesStatus;
};

export type JobCard = BaseRow & {
  kind: "workshop";
  jobRef: string;
  customerName: string;
  vehicleNumber: string;
  vehicle: string;
  serviceType: string;
  status: JobStatus;
  estimatedCost: number;
};

export type FulfilmentOrder = BaseRow & {
  kind: "parts";
  orderRef: string;
  customerName: string;
  mobile: string;
  items: string;
  total: number;
  status: OrderStatus;
};

export type Application = BaseRow & {
  kind: "finance" | "insurance";
  reference: string;
  customerName: string;
  mobile: string;
  vehicle: string;
  provider: string;
  amount: number;
  status: ApplicationStatus;
};

export type DeskRow = SalesLead | JobCard | FulfilmentOrder | Application;

type Store<T> = { seededAt: string; rows: T[] };

const KEYS: Record<DeskKey, string> = {
  sales: "mw_desk_sales_v1",
  workshop: "mw_desk_workshop_v1",
  parts: "mw_desk_parts_v1",
  finance: "mw_desk_finance_v1",
  insurance: "mw_desk_insurance_v1",
};

const now = () => new Date().toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const note = (by: string, text: string, hours: number): DeskNote => ({
  id: `dnote-${Math.random().toString(36).slice(2, 9)}`,
  at: hoursAgo(hours),
  by,
  text,
});

/* ------------------------------------------------------------ demo rows */

const DEMO_SALES: SalesLead[] = [
  {
    kind: "sales",
    id: "lead-demo-1",
    caseId: null,
    assignedTo: "EMP-1004",
    customerName: "Rohit Deshmukh",
    mobile: "9820014570",
    vehicle: "2021 Hyundai Creta SX",
    source: "Marketplace",
    status: "Contacted",
    notes: [note("Priyanka Shah", "Called at 11:20 — wants a test drive this weekend.", 5)],
    createdAt: hoursAgo(28),
    updatedAt: hoursAgo(5),
  },
  {
    kind: "sales",
    id: "lead-demo-2",
    caseId: null,
    assignedTo: "EMP-1004",
    customerName: "Farah Khan",
    mobile: "9619902214",
    vehicle: "2019 Maruti Swift VXi",
    source: "Website",
    status: "New",
    notes: [],
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(3),
  },
  {
    kind: "sales",
    id: "lead-demo-3",
    caseId: null,
    assignedTo: null,
    customerName: "Sandeep Patil",
    mobile: "9867554120",
    vehicle: "Royal Enfield Classic 350",
    source: "Walk-in",
    status: "Follow-up",
    notes: [note("Desk", "Quoted ₹1.42L; waiting on his bank approval.", 22)],
    createdAt: hoursAgo(52),
    updatedAt: hoursAgo(22),
  },
  {
    kind: "sales",
    id: "lead-demo-4",
    caseId: null,
    assignedTo: "EMP-1004",
    customerName: "Neha Bansal",
    mobile: "9730022119",
    vehicle: "Tata Nexon EV Max",
    source: "Referral",
    status: "Deal in Process",
    notes: [note("Priyanka Shah", "Loan sanctioned, RTO paperwork in progress.", 8)],
    createdAt: hoursAgo(70),
    updatedAt: hoursAgo(8),
  },
  {
    kind: "sales",
    id: "lead-demo-5",
    caseId: null,
    assignedTo: "EMP-1004",
    customerName: "Imran Qureshi",
    mobile: "9004221188",
    vehicle: "2020 Toyota Innova Crysta",
    source: "Phone",
    status: "Deal Closed",
    notes: [note("Priyanka Shah", "Delivered on 12th; paperwork filed.", 96)],
    createdAt: hoursAgo(140),
    updatedAt: hoursAgo(96),
  },
];

const DEMO_JOBS: JobCard[] = [
  {
    kind: "workshop",
    id: "job-demo-1",
    caseId: null,
    assignedTo: "EMP-1003",
    jobRef: "JC-4412",
    customerName: "Ganesh Pawar",
    vehicleNumber: "MH-01-AB-4412",
    vehicle: "Hyundai i20 Sportz 2021",
    serviceType: "60,000 km service",
    status: "In Progress",
    estimatedCost: 8400,
    notes: [note("Rahul Menon", "Engine oil and filters replaced; alignment pending.", 2)],
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(2),
  },
  {
    kind: "workshop",
    id: "job-demo-2",
    caseId: null,
    assignedTo: "EMP-1003",
    jobRef: "JC-4413",
    customerName: "Sunita Rane",
    vehicleNumber: "MH-02-CD-7710",
    vehicle: "Maruti Baleno Zeta 2019",
    serviceType: "AC compressor replacement",
    status: "Waiting for Parts",
    estimatedCost: 18500,
    notes: [note("Rahul Menon", "Compressor ordered from the Thane warehouse.", 9)],
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(9),
  },
  {
    kind: "workshop",
    id: "job-demo-3",
    caseId: null,
    assignedTo: null,
    jobRef: "JC-4414",
    customerName: "Arif Shaikh",
    vehicleNumber: "MH-03-EF-2288",
    vehicle: "Bajaj Pulsar NS200 2022",
    serviceType: "Brake pads + chain set",
    status: "Pending",
    estimatedCost: 3200,
    notes: [],
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
  },
  {
    kind: "workshop",
    id: "job-demo-4",
    caseId: null,
    assignedTo: "EMP-1003",
    jobRef: "JC-4409",
    customerName: "Deepa Iyer",
    vehicleNumber: "MH-04-GH-9021",
    vehicle: "Kia Seltos HTX 2022",
    serviceType: "Denting & painting — rear bumper",
    status: "Ready for Delivery",
    estimatedCost: 11200,
    notes: [note("Rahul Menon", "Quality check cleared, customer informed.", 4)],
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(4),
  },
  {
    kind: "workshop",
    id: "job-demo-5",
    caseId: null,
    assignedTo: "EMP-1003",
    jobRef: "JC-4401",
    customerName: "Vishal Gaikwad",
    vehicleNumber: "MH-12-JK-3344",
    vehicle: "Mahindra Scorpio N 2023",
    serviceType: "Periodic service + wheel balancing",
    status: "Delivered",
    estimatedCost: 6700,
    notes: [note("Rahul Menon", "Handed over at 6:40 pm, invoice MW-JC-4401.", 26)],
    createdAt: hoursAgo(120),
    updatedAt: hoursAgo(26),
  },
];

const DEMO_ORDERS: FulfilmentOrder[] = [
  {
    kind: "parts",
    id: "order-demo-1",
    caseId: null,
    assignedTo: "EMP-1006",
    orderRef: "MW-ORD-48210",
    customerName: "Karan Malhotra",
    mobile: "9820334455",
    items: "Alloy wheels (4) · Seat covers",
    total: 28600,
    status: "Packed",
    notes: [note("Meera Iyer", "Both cartons sealed and labelled.", 3)],
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(3),
  },
  {
    kind: "parts",
    id: "order-demo-2",
    caseId: null,
    assignedTo: "EMP-1006",
    orderRef: "MW-ORD-48214",
    customerName: "Ritika Sen",
    mobile: "9871100923",
    items: "Ambient lighting kit · Floor mats",
    total: 7400,
    status: "Pending",
    notes: [],
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(4),
  },
  {
    kind: "parts",
    id: "order-demo-3",
    caseId: null,
    assignedTo: null,
    orderRef: "MW-ORD-48218",
    customerName: "Mohit Rathore",
    mobile: "9004556612",
    items: "Roof wrap (matte black) · Chrome delete",
    total: 15200,
    status: "Shipped",
    notes: [note("Meera Iyer", "Courier DTDC, AWB 8923-1145.", 11)],
    createdAt: hoursAgo(44),
    updatedAt: hoursAgo(11),
  },
  {
    kind: "parts",
    id: "order-demo-4",
    caseId: null,
    assignedTo: "EMP-1006",
    orderRef: "MW-ORD-48202",
    customerName: "Ayesha Merchant",
    mobile: "9619988776",
    items: "Custom leather steering cover",
    total: 2900,
    status: "Delivered",
    notes: [note("Meera Iyer", "Delivered, feedback 5/5.", 60)],
    createdAt: hoursAgo(130),
    updatedAt: hoursAgo(60),
  },
  {
    kind: "parts",
    id: "order-demo-5",
    caseId: null,
    assignedTo: null,
    orderRef: "MW-ORD-48199",
    customerName: "Prakash Bhat",
    mobile: "9345601122",
    items: "Dash cam (dual channel)",
    total: 8800,
    status: "Cancelled",
    notes: [note("Meera Iyer", "Customer cancelled before dispatch; refunded.", 70)],
    createdAt: hoursAgo(150),
    updatedAt: hoursAgo(70),
  },
];

const DEMO_FINANCE: Application[] = [
  {
    kind: "finance",
    id: "app-demo-1",
    caseId: null,
    assignedTo: "EMP-1001",
    reference: "MW-FIN-7701",
    customerName: "Rahul Verma",
    mobile: "9811045230",
    vehicle: "Tata Nexon XZ+ 2022",
    provider: "HDFC Bank",
    amount: 840000,
    status: "Under Review",
    notes: [note("Ananya Rao", "Salary slips and 6-month statement uploaded.", 6)],
    createdAt: hoursAgo(24),
    updatedAt: hoursAgo(6),
  },
  {
    kind: "finance",
    id: "app-demo-2",
    caseId: null,
    assignedTo: null,
    reference: "MW-FIN-7702",
    customerName: "Sneha Kulkarni",
    mobile: "9822076412",
    vehicle: "Hyundai Creta SX 2023",
    provider: "ICICI Bank",
    amount: 1260000,
    status: "Submitted",
    notes: [],
    createdAt: hoursAgo(9),
    updatedAt: hoursAgo(9),
  },
  {
    kind: "finance",
    id: "app-demo-3",
    caseId: null,
    assignedTo: "EMP-1001",
    reference: "MW-FIN-7694",
    customerName: "Imran Sheikh",
    mobile: "9867304511",
    vehicle: "Maruti Baleno Zeta 2022",
    provider: "Bajaj Finance",
    amount: 560000,
    status: "Approved",
    notes: [note("Ananya Rao", "Sanction letter issued; disbursal scheduled.", 40)],
    createdAt: hoursAgo(120),
    updatedAt: hoursAgo(40),
  },
  {
    kind: "finance",
    id: "app-demo-4",
    caseId: null,
    assignedTo: "EMP-1001",
    reference: "MW-FIN-7688",
    customerName: "Nitin Chavan",
    mobile: "9700214433",
    vehicle: "Honda City VX 2021",
    provider: "Axis Bank",
    amount: 720000,
    status: "Rejected",
    notes: [note("Ananya Rao", "Low CIBIL; suggested a co-applicant route.", 200)],
    createdAt: hoursAgo(260),
    updatedAt: hoursAgo(200),
  },
];

const DEMO_INSURANCE: Application[] = [
  {
    kind: "insurance",
    id: "ins-demo-1",
    caseId: null,
    assignedTo: "EMP-1002",
    reference: "MW-INS-5521",
    customerName: "Priya Nair",
    mobile: "9700012233",
    vehicle: "Kia Seltos HTX 2022",
    provider: "ICICI Lombard",
    amount: 18400,
    status: "Under Review",
    notes: [note("Vikram Shetty", "Zero-depreciation add-on requested.", 4)],
    createdAt: hoursAgo(12),
    updatedAt: hoursAgo(4),
  },
  {
    kind: "insurance",
    id: "ins-demo-2",
    caseId: null,
    assignedTo: null,
    reference: "MW-INS-5524",
    customerName: "Arjun Menon",
    mobile: "9744581120",
    vehicle: "Bajaj Pulsar NS200 2021",
    provider: "HDFC Ergo",
    amount: 9800,
    status: "Submitted",
    notes: [],
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(6),
  },
  {
    kind: "insurance",
    id: "ins-demo-3",
    caseId: null,
    assignedTo: "EMP-1002",
    reference: "MW-INS-5510",
    customerName: "Kavita Joshi",
    mobile: "9611220087",
    vehicle: "Maruti Ertiga ZXi 2020",
    provider: "Bajaj Allianz",
    amount: 14600,
    status: "Approved",
    notes: [note("Vikram Shetty", "Policy issued, soft copy mailed.", 30)],
    createdAt: hoursAgo(90),
    updatedAt: hoursAgo(30),
  },
  {
    kind: "insurance",
    id: "ins-demo-4",
    caseId: null,
    assignedTo: "EMP-1002",
    reference: "MW-INS-5499",
    customerName: "Dinesh Kamble",
    mobile: "9005671223",
    vehicle: "Tata Tiago XT 2018",
    provider: "New India Assurance",
    amount: 7200,
    status: "Rejected",
    notes: [note("Vikram Shetty", "Vehicle had a prior total-loss claim.", 150)],
    createdAt: hoursAgo(200),
    updatedAt: hoursAgo(150),
  },
];

/* --------------------------------------------------------- CRM → desk rows */

function pushedBy(cases: CrmCase[], desk: DeskKey): CrmCase[] {
  const types = DESK_CASE_TYPES[desk];
  return cases.filter((item) => types.includes(item.type));
}

function caseNotes(item: CrmCase): DeskNote[] {
  return item.notes.map((entry) => ({
    id: entry.id,
    at: entry.at,
    by: entry.by,
    text: entry.text,
  }));
}

const refNumber = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 90000;
  }
  return String(10000 + hash);
};

/** CRM cases of this desk's business lines, as desk rows. */
function importFromCases(desk: DeskKey, cases: CrmCase[]): DeskRow[] {
  return pushedBy(cases, desk).map<DeskRow>((item) => {
    const base = {
      id: item.id,
      caseId: item.id,
      assignedTo: item.assignedTo,
      notes: caseNotes(item),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    if (desk === "sales") {
      return {
        ...base,
        kind: "sales",
        customerName: item.customerName,
        mobile: item.mobile,
        vehicle: item.vehicle ?? "Vehicle not captured",
        source: item.source,
        status: salesStatusFrom(item.status),
      } satisfies SalesLead;
    }
    if (desk === "workshop") {
      return {
        ...base,
        kind: "workshop",
        jobRef: `JC-${refNumber(item.id).slice(0, 4)}`,
        customerName: item.customerName,
        vehicleNumber:
          item.vehicle && /^[A-Z]{2}-\d{2}/i.test(item.vehicle) ? item.vehicle : "Not captured",
        vehicle: item.vehicle ?? "Vehicle not captured",
        serviceType: item.summary.slice(0, 70),
        status: jobStatusFrom(item.status),
        estimatedCost: item.value,
      } satisfies JobCard;
    }
    if (desk === "parts") {
      return {
        ...base,
        kind: "parts",
        orderRef: `MW-ORD-${refNumber(item.id)}`,
        customerName: item.customerName,
        mobile: item.mobile,
        items: item.summary.slice(0, 90),
        total: item.value,
        status: orderStatusFrom(item.status),
      } satisfies FulfilmentOrder;
    }
    return {
      ...base,
      kind: desk === "finance" ? "finance" : "insurance",
      reference: `MW-${desk === "finance" ? "FIN" : "INS"}-${refNumber(item.id).slice(0, 4)}`,
      customerName: item.customerName,
      mobile: item.mobile,
      vehicle: item.vehicle ?? "Vehicle not captured",
      provider: desk === "finance" ? "Partner lender" : "Partner insurer",
      amount: item.value,
      status: applicationStatusFrom(item.status),
    } satisfies Application;
  });
}

const DEMO_BY_DESK: Record<DeskKey, () => DeskRow[]> = {
  sales: () => DEMO_SALES.map((row) => ({ ...row })),
  workshop: () => DEMO_JOBS.map((row) => ({ ...row })),
  parts: () => DEMO_ORDERS.map((row) => ({ ...row })),
  finance: () => DEMO_FINANCE.map((row) => ({ ...row })),
  insurance: () => DEMO_INSURANCE.map((row) => ({ ...row })),
};

/* --------------------------------------------------------------- storage */

function readStore<T extends DeskRow>(desk: DeskKey): Store<T> | null {
  const parsed = replicaRead<Store<T> | null>(KEYS[desk], null);
  if (!parsed || !Array.isArray(parsed.rows)) return null;
  return parsed;
}

function writeStore<T extends DeskRow>(desk: DeskKey, store: Store<T>): boolean {
  return replicaWrite(KEYS[desk], store);
}

/**
 * First read of a desk builds its board from the Master Tracker's matching
 * cases plus a set of demo rows, so the desk is never empty on day one.
 */
function ensureStore<T extends DeskRow>(desk: DeskKey): Store<T> {
  const existing = readStore<T>(desk);
  if (existing) return existing;

  const snapshot = ensureAdminDatabase();
  const imported = importFromCases(desk, snapshot.cases) as T[];
  const seen = new Set(imported.map((row) => row.id));
  const rows = [...imported, ...DEMO_BY_DESK[desk]().filter((row) => !seen.has(row.id))] as T[];
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const store: Store<T> = { seededAt: now(), rows };
  writeStore(desk, store);
  return store;
}

/* ------------------------------------------------------------- read guard */

/** The desk the signed-in person may open, or null when they have none. */
export function employeeDesk(actor: Actor & { category?: string | null }): DeskKey | null {
  if (!actor.department) return null;
  return deskForEmployee(actor.department, actor.category);
}

/**
 * The single read path for the dashboard. Returns null when the actor has no
 * desk — never another department's board.
 */
export function readDesk(
  actor: Actor & { category?: string | null },
): { desk: DeskKey; rows: DeskRow[] } | null {
  if (typeof window === "undefined") return null;
  const desk = employeeDesk(actor);
  if (!desk) return null;
  return { desk, rows: ensureStore<DeskRow>(desk).rows };
}

export function readDeskRows<T extends DeskRow>(
  actor: Actor & { category?: string | null },
  desk: DeskKey,
): T[] {
  if (employeeDesk(actor) !== desk) return [];
  return ensureStore<T>(desk).rows;
}

/* -------------------------------------------------------------- mutations */

export type DeskResult = { ok: true; row: DeskRow } | { ok: false; error: string };

type DeskActor = Actor & { category?: string | null };

function guard(actor: DeskActor, desk: DeskKey, row: DeskRow): string | null {
  if (employeeDesk(actor) !== desk) {
    return "Your account is not assigned to this department.";
  }
  const type = DESK_CASE_TYPES[desk][0] ?? "Vehicle Enquiry";
  if (!canEditCase(actor, { type, assignedTo: row.assignedTo })) {
    return actor.role === "executive"
      ? "This case is assigned to someone else. Ask your manager to reassign it."
      : "Your role can read this desk but not change it.";
  }
  return null;
}

/** Keeps the Master Tracker in step with a desk change, without blocking it. */
function mirrorCase(row: DeskRow, status: CaseStatus, actor: DeskActor) {
  if (!row.caseId) return;
  try {
    updateCaseStatus(row.caseId, status, actor);
  } catch {
    /* the desk row is already saved; a mirror miss is reported by the tracker */
  }
}

function pushNote(row: DeskRow, text: string, actor: DeskActor): DeskNote[] {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return row.notes;
  if (row.caseId) {
    try {
      addCaseNote(row.caseId, trimmed, actor);
    } catch {
      /* keep the desk note even if the CRM copy fails */
    }
  }
  return [
    ...row.notes,
    {
      id: `dnote-${Math.random().toString(36).slice(2, 9)}`,
      at: now(),
      by: actor.name,
      text: trimmed,
    },
  ];
}

function commit<T extends DeskRow>(
  desk: DeskKey,
  row: T,
  update: (current: T) => T,
  note?: string,
  actor?: DeskActor,
  caseStatus?: CaseStatus,
): DeskResult {
  const store = ensureStore<T>(desk);
  const current = store.rows.find((item) => item.id === row.id);
  if (!current) return { ok: false, error: "That record no longer exists." };

  const next: T = {
    ...update(current),
    updatedAt: now(),
    notes: note && actor ? pushNote(current, note, actor) : current.notes,
  };
  const rows = store.rows.map((item) => (item.id === next.id ? next : item));
  if (!writeStore(desk, { ...store, rows })) {
    return { ok: false, error: "This browser refused the write. Check storage permissions." };
  }
  if (caseStatus && actor) mirrorCase(next, caseStatus, actor);
  notifyDesk();
  return { ok: true, row: next };
}

function findRow(desk: DeskKey, id: string): DeskRow | null {
  return ensureStore<DeskRow>(desk).rows.find((item) => item.id === id) ?? null;
}

export function updateSalesLead(
  actor: DeskActor,
  id: string,
  input: { status?: SalesStatus; note?: string },
): DeskResult {
  const row = findRow("sales", id);
  if (!row || row.kind !== "sales") return { ok: false, error: "That lead no longer exists." };
  const denial = guard(actor, "sales", row);
  if (denial) return { ok: false, error: denial };
  if (input.status && !SALES_STATUSES.includes(input.status)) {
    return { ok: false, error: "That status is not part of the sales desk." };
  }
  return commit<SalesLead>(
    "sales",
    row,
    (current) => ({ ...current, status: input.status ?? current.status }),
    input.note,
    actor,
    input.status ? TO_CASE[input.status] : undefined,
  );
}

export function updateJobCard(
  actor: DeskActor,
  id: string,
  input: { status?: JobStatus; note?: string; estimatedCost?: number },
): DeskResult {
  const row = findRow("workshop", id);
  if (!row || row.kind !== "workshop")
    return { ok: false, error: "That job card no longer exists." };
  const denial = guard(actor, "workshop", row);
  if (denial) return { ok: false, error: denial };
  if (input.status && !JOB_STATUSES.includes(input.status)) {
    return { ok: false, error: "That status is not part of the workshop board." };
  }
  if (
    input.estimatedCost !== undefined &&
    (!Number.isFinite(input.estimatedCost) || input.estimatedCost < 0)
  ) {
    return { ok: false, error: "Enter a valid estimated cost." };
  }
  return commit<JobCard>(
    "workshop",
    row,
    (current) => ({
      ...current,
      status: input.status ?? current.status,
      estimatedCost: input.estimatedCost ?? current.estimatedCost,
    }),
    input.note,
    actor,
    input.status ? TO_CASE[input.status] : undefined,
  );
}

export function updateOrder(
  actor: DeskActor,
  id: string,
  input: { status?: OrderStatus; note?: string },
): DeskResult {
  const row = findRow("parts", id);
  if (!row || row.kind !== "parts") return { ok: false, error: "That order no longer exists." };
  const denial = guard(actor, "parts", row);
  if (denial) return { ok: false, error: denial };
  if (input.status && !ORDER_STATUSES.includes(input.status)) {
    return { ok: false, error: "That status is not part of order fulfilment." };
  }
  return commit<FulfilmentOrder>(
    "parts",
    row,
    (current) => ({ ...current, status: input.status ?? current.status }),
    input.note,
    actor,
    input.status ? TO_CASE[input.status] : undefined,
  );
}

export function updateApplication(
  actor: DeskActor,
  desk: "finance" | "insurance",
  id: string,
  input: { status?: ApplicationStatus; note?: string },
): DeskResult {
  if (desk !== "finance" && desk !== "insurance") {
    return { ok: false, error: "Unknown application desk." };
  }
  const row = findRow(desk, id);
  if (!row || (row.kind !== "finance" && row.kind !== "insurance")) {
    return { ok: false, error: "That application no longer exists." };
  }
  const denial = guard(actor, desk, row);
  if (denial) return { ok: false, error: denial };
  if (input.status && !APPLICATION_STATUSES.includes(input.status)) {
    return { ok: false, error: "That status is not part of the application tracker." };
  }
  return commit<Application>(
    desk,
    row,
    (current) => ({ ...current, status: input.status ?? current.status }),
    input.note,
    actor,
    input.status ? TO_CASE[input.status] : undefined,
  );
}

/* --------------------------------------------------------------- listeners */

const listeners = new Set<() => void>();

function notifyDesk() {
  listeners.forEach((listener) => listener());
}

/** Desk edits + CRM imports from another tab both refresh the board. */
export function subscribeToDeskData(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || (Object.values(KEYS) as string[]).includes(event.key)) listener();
  };
  window.addEventListener("storage", onStorage);
  const unsubscribeAdmin = subscribeToAdminData(listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    unsubscribeAdmin();
  };
}

/* --------------------------------------------------------------- helpers */

export const DESK_STATUS_OPTIONS = {
  sales: SALES_STATUSES,
  workshop: JOB_STATUSES,
  parts: ORDER_STATUSES,
  finance: APPLICATION_STATUSES,
  insurance: APPLICATION_STATUSES,
} as const;

export function statusTone(status: string): string {
  return status
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const inr = (value: number): string => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function deskCounts(desk: DeskKey, rows: DeskRow[]) {
  const open = rows.filter((row) => {
    if (row.kind === "sales") return row.status !== "Deal Closed";
    if (row.kind === "workshop") return row.status !== "Delivered";
    if (row.kind === "parts") return row.status !== "Delivered" && row.status !== "Cancelled";
    return row.status === "Submitted" || row.status === "Under Review";
  }).length;
  const settled = rows.filter((row) => {
    if (row.kind === "sales") return row.status === "Deal Closed";
    if (row.kind === "workshop") return row.status === "Delivered";
    if (row.kind === "parts") return row.status === "Delivered";
    return row.status === "Approved";
  }).length;
  const value = rows.reduce(
    (total, row) =>
      total +
      (row.kind === "workshop"
        ? row.estimatedCost
        : row.kind === "sales"
          ? 0
          : "total" in row
            ? row.total
            : row.amount),
    0,
  );
  return { total: rows.length, open, settled, value, desk };
}
