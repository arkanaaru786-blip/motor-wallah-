/**
 * Advanced workshop flow: customer enquiry → acceptance / pickup assignment →
 * vehicle received → digital checklist and final estimate.
 *
 * The enquiry record lives in the Supabase-backed `app_records` collection
 * (`mw_workshop_enquiries_v1`), with the customer intent also written to the
 * structured `leads` table by the booking form. A new enquiry starts
 * unclaimed (`partnerId: null`) so the first workshop that accepts it owns it;
 * after acceptance every read and write is scoped to that workshop.
 *
 * Money model: repair items are labour (denting, painting, mechanical work),
 * replacement items are parts sourced from MW Auto Parts, and the discount is
 * applied only to the labour subtotal.
 */
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { ensureWorkshopPartsOrder, partsOrderForEnquiry } from "@/lib/partner-data";
import { newTrackingId } from "@/lib/service-tracking";

const KEY = "mw_workshop_enquiries_v1";

/* ------------------------------------------------------------ departments */

export type WorkshopDepartmentId =
  "denting" | "painting" | "mechanical" | "electrical" | "detailing" | "car-wash";

export type WorkshopDepartment = {
  id: WorkshopDepartmentId;
  label: string;
  blurb: string;
  examples: string;
  from: number;
};

export const WORKSHOP_DEPARTMENTS: WorkshopDepartment[] = [
  {
    id: "denting",
    label: "Denting",
    blurb: "Dents, dings and panel reshaping",
    examples: "Door dents · bumper repair · panel alignment",
    from: 800,
  },
  {
    id: "painting",
    label: "Painting",
    blurb: "Panel paint, touch-ups and polish",
    examples: "Full panel paint · spot repair · clear coat",
    from: 1500,
  },
  {
    id: "mechanical",
    label: "Mechanical",
    blurb: "Engine, brakes, suspension and clutch",
    examples: "General service · brakes · clutch · suspension",
    from: 999,
  },
  {
    id: "electrical",
    label: "Electrical",
    blurb: "Battery, wiring, lights and AC",
    examples: "Battery · alternator · wiring · AC cooling",
    from: 499,
  },
  {
    id: "detailing",
    label: "Detailing",
    blurb: "Deep clean, ceramic and interior spa",
    examples: "Ceramic coating · interior spa · paint correction",
    from: 1499,
  },
  {
    id: "car-wash",
    label: "Car Wash",
    blurb: "Foam wash, underbody and vacuum",
    examples: "Foam wash · underbody · vacuum · tyre dressing",
    from: 299,
  },
];

export const isWorkshopDepartment = (value: unknown): value is WorkshopDepartmentId =>
  typeof value === "string" && WORKSHOP_DEPARTMENTS.some((item) => item.id === value);

export const getWorkshopDepartment = (id: string | undefined | null) =>
  WORKSHOP_DEPARTMENTS.find((item) => item.id === id) ?? null;

/* --------------------------------------------------------------- statuses */

export const ENQUIRY_STATUSES = [
  "New",
  "Accepted",
  "Vehicle Received",
  "Estimate Sent",
  "Approved",
  "Estimate Locked",
  "Paid",
  "Ready for Delivery",
  "Delivered",
  "Completed",
  "Rejected",
  "Cancelled",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_CHIP: Record<EnquiryStatus, string> = {
  New: "is-pending",
  Accepted: "is-progress",
  "Vehicle Received": "is-parts",
  "Estimate Sent": "is-ready",
  Approved: "is-progress",
  "Estimate Locked": "is-ready",
  Paid: "is-delivered",
  "Ready for Delivery": "is-ready",
  Delivered: "is-delivered",
  Completed: "is-delivered",
  Rejected: "is-cancelled",
  Cancelled: "is-cancelled",
};

/** Client-facing labels keep the workshop's internal wording out of the way. */
export const CUSTOMER_STATUS_LABEL: Record<EnquiryStatus, string> = {
  New: "Enquiry received",
  Accepted: "Workshop accepted",
  "Vehicle Received": "Vehicle in workshop",
  "Estimate Sent": "Estimate sent",
  Approved: "Approval OTP sent",
  "Estimate Locked": "Estimate locked — payment pending",
  Paid: "Vehicle Received for Service",
  "Ready for Delivery": "Vehicle ready — inspect & share final OTP",
  Delivered: "Vehicle delivered",
  Completed: "Completed",
  Rejected: "Estimate rejected",
  Cancelled: "Cancelled",
};

/** Workshop-facing labels. Paid work reads as received for service on both sides. */
export const WORKSHOP_STATUS_LABEL: Record<EnquiryStatus, string> = {
  New: "New",
  Accepted: "Accepted",
  "Vehicle Received": "Vehicle Received",
  "Estimate Sent": "Estimate Sent",
  Approved: "Approved — OTP pending",
  "Estimate Locked": "Estimate Locked — payment pending",
  Paid: "Vehicle Received for Service",
  "Ready for Delivery": "Ready for Delivery",
  Delivered: "Completed",
  Completed: "Completed",
  Rejected: "Rejected by customer",
  Cancelled: "Cancelled",
};

/** Tracking stage index for the five-step customer progress bar. */
export function enquiryStageIndex(status: EnquiryStatus): number {
  switch (status) {
    case "New":
      return 0;
    case "Accepted":
      return 1;
    case "Vehicle Received":
      return 2;
    case "Estimate Sent":
    case "Approved":
    case "Estimate Locked":
    case "Paid":
      return 2;
    case "Ready for Delivery":
      return 3;
    case "Delivered":
    case "Completed":
      return 4;
    default:
      return 0;
  }
}

/* -------------------------------------------------------------- line items */

export type EnquiryLine = {
  id: string;
  name: string;
  qty: number;
  cost: number;
  /** Present only for replacement items sourced from the parts catalogue. */
  partId?: string;
};

export type AssignmentMode = "pickup" | "visit";

export type EnquiryAssignment = {
  mode: AssignmentMode;
  employeeId: string | null;
  employeeName: string | null;
  employeeMobile: string | null;
  note: string;
  acceptedAt: string;
};

export type EnquiryTimeline = { status: EnquiryStatus; at: string };

export type EnquiryApproval = {
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string;
  otpCode: string | null;
  otpSentAt: string | null;
  otpVerifiedAt: string | null;
  /** Snapshot of the price the customer accepted; later edits cannot change it. */
  lockedTotal: number | null;
};

export type EnquiryPayment = {
  status: "Pending" | "Paid";
  /** "Preview" exists only on the development server when Razorpay keys are absent. */
  provider: "Razorpay" | "Preview";
  orderId: string | null;
  paymentId: string | null;
  amount: number | null;
  paidAt: string | null;
};

export type EnquiryDelivery = {
  readyAt: string | null;
  finalOtpCode: string | null;
  finalOtpSentAt: string | null;
  finalOtpVerifiedAt: string | null;
  deliveredAt: string | null;
};

/** Fixed preview OTPs until an SMS provider is connected. */
export const MOCK_ENQUIRY_OTP = "1234";
export const MOCK_FINAL_OTP = "5678";
export const PREPAID_ONLY_NOTICE =
  "Online Prepaid Only. Cash/Offline payments are strictly prohibited.";
export const VEHICLE_READY_NOTICE = "Your vehicle is ready. Inspect it and share final OTP.";

const emptyApproval = (): EnquiryApproval => ({
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: "",
  otpCode: null,
  otpSentAt: null,
  otpVerifiedAt: null,
  lockedTotal: null,
});

const emptyPayment = (): EnquiryPayment => ({
  status: "Pending",
  provider: "Razorpay",
  orderId: null,
  paymentId: null,
  amount: null,
  paidAt: null,
});

const emptyDelivery = (): EnquiryDelivery => ({
  readyAt: null,
  finalOtpCode: null,
  finalOtpSentAt: null,
  finalOtpVerifiedAt: null,
  deliveredAt: null,
});

export type WorkshopEnquiry = {
  id: string;
  trackingId: string;
  /** null until a workshop accepts it. */
  partnerId: string | null;
  workshopName: string | null;
  workshopMobile: string | null;
  customerName: string;
  mobile: string;
  category: string;
  department: WorkshopDepartmentId;
  serviceType: string;
  vehicleNumber: string;
  vehicle: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  issue: string;
  location: string;
  preferredDate: string;
  preferredTime: string;
  photoCount: number;
  status: EnquiryStatus;
  assignment: EnquiryAssignment | null;
  vehicleReceivedAt: string | null;
  checklist: {
    repairItems: EnquiryLine[];
    replaceItems: EnquiryLine[];
    discount: number;
    notes: string;
    sentAt: string | null;
    sentVersion: number;
  };
  approval: EnquiryApproval;
  payment: EnquiryPayment;
  delivery: EnquiryDelivery;
  timeline: EnquiryTimeline[];
  createdAt: string;
  updatedAt: string;
};

export type EnquiryResult = { ok: true } | { ok: false; error: string };
export type CreateEnquiryResult =
  { ok: true; enquiry: WorkshopEnquiry } | { ok: false; error: string };

/* ------------------------------------------------------- workshop team */

export type WorkshopTeamMember = {
  id: string;
  name: string;
  role: string;
  mobile: string;
};

/** Demo bay team shown to every workshop until a staff directory is connected. */
export const WORKSHOP_TEAM: WorkshopTeamMember[] = [
  { id: "WRK-TEAM-01", name: "Sagar Pawar", role: "Pickup driver", mobile: "9820012211" },
  { id: "WRK-TEAM-02", name: "Imran Shaikh", role: "Pickup driver", mobile: "9820012212" },
  { id: "WRK-TEAM-03", name: "Neha Kadam", role: "Service advisor", mobile: "9820012213" },
  { id: "WRK-TEAM-04", name: "Rohit Bhosale", role: "Senior technician", mobile: "9820012214" },
];

/* ------------------------------------------------------- parts catalogue */

export type AutoPart = { id: string; name: string; category: string; price: number };

/** Curated replacement shelf representing MW Auto Parts in the workshop. */
export const MW_AUTO_PARTS: AutoPart[] = [
  { id: "front-bumper", name: "Front Bumper", category: "Body", price: 2000 },
  { id: "rear-bumper", name: "Rear Bumper", category: "Body", price: 1800 },
  { id: "headlamp", name: "Headlamp Assembly", category: "Lights", price: 3200 },
  { id: "tail-lamp", name: "Tail Lamp Assembly", category: "Lights", price: 2400 },
  { id: "orvm", name: "ORVM Mirror Pair", category: "Body", price: 1450 },
  { id: "door-handle", name: "Door Handle Set", category: "Body", price: 850 },
  { id: "bonnet-hinge", name: "Bonnet Hinge Kit", category: "Body", price: 650 },
  { id: "brake-pads", name: "Front Brake Pad Set", category: "Brakes", price: 2890 },
  { id: "air-filter", name: "Engine Air Filter", category: "Engine", price: 690 },
  { id: "battery", name: "12V Battery", category: "Electricals", price: 6800 },
  { id: "clutch-kit", name: "Clutch Plate Kit", category: "Transmission", price: 4500 },
  { id: "windshield", name: "Windshield Glass", category: "Glass", price: 5200 },
];

/* ------------------------------------------------------------------ read */

/** Phase 2 records predate approval/payment, so fill their new fields on read. */
function normaliseEnquiry(row: WorkshopEnquiry): WorkshopEnquiry {
  return {
    ...row,
    approval: { ...emptyApproval(), ...(row.approval ?? {}) },
    payment: { ...emptyPayment(), ...(row.payment ?? {}) },
    delivery: { ...emptyDelivery(), ...(row.delivery ?? {}) },
  };
}

function readAll(): WorkshopEnquiry[] {
  const raw = replicaRead<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  return (raw as WorkshopEnquiry[])
    .filter((row) => row && typeof row.id === "string" && typeof row.trackingId === "string")
    .map(normaliseEnquiry);
}

function writeAll(rows: WorkshopEnquiry[]): EnquiryResult {
  return replicaWrite(KEY, rows)
    ? { ok: true }
    : { ok: false, error: "Storage is full or blocked, so the change was not saved." };
}

function replaceEnquiry(rows: WorkshopEnquiry[], next: WorkshopEnquiry): EnquiryResult {
  return writeAll(rows.map((row) => (row.id === next.id ? next : row)));
}

/** New unclaimed enquiries plus everything this workshop has accepted. */
export const workshopEnquiries = (partnerId: string): WorkshopEnquiry[] =>
  readAll()
    .filter((row) => row.partnerId === partnerId || row.partnerId === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const findEnquiryByTracking = (
  trackingId: string,
  mobile?: string,
): WorkshopEnquiry | null => {
  const wanted = trackingId.trim().toUpperCase();
  return (
    readAll().find(
      (row) =>
        row.trackingId.toUpperCase() === wanted &&
        (mobile === undefined || row.mobile.replace(/\s+/g, "") === mobile.replace(/\s+/g, "")),
    ) ?? null
  );
};

export const getEnquiry = (id: string): WorkshopEnquiry | null =>
  readAll().find((row) => row.id === id) ?? null;

/* --------------------------------------------------------------- create */

export type NewEnquiryInput = {
  customerName: string;
  mobile: string;
  category: string;
  department: WorkshopDepartmentId;
  serviceType: string;
  vehicleNumber: string;
  vehicle: string;
  brand: string;
  model: string;
  year: string;
  fuel: string;
  issue: string;
  location: string;
  preferredDate: string;
  preferredTime: string;
  photoCount: number;
};

const mobileOk = (value: string) => /^[0-9+ ]{10,15}$/.test(value.trim());

function newEnquiryId(existing: WorkshopEnquiry[]): string {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const id = `MW-ENQ-${Math.floor(Math.random() * 90000) + 10000}`;
    if (!existing.some((row) => row.id === id)) return id;
  }
  return `MW-ENQ-${String(Date.now()).slice(-5)}`;
}

export function createWorkshopEnquiry(input: NewEnquiryInput): CreateEnquiryResult {
  const name = input.customerName.trim();
  const mobile = input.mobile.trim();
  if (name.length < 2) return { ok: false, error: "Enter the customer name." };
  if (!mobileOk(mobile)) return { ok: false, error: "Enter a valid mobile number." };
  if (!isWorkshopDepartment(input.department)) {
    return { ok: false, error: "Choose a workshop department." };
  }

  const rows = readAll();
  const now = new Date().toISOString();
  const enquiry: WorkshopEnquiry = {
    id: newEnquiryId(rows),
    trackingId: newTrackingId(),
    partnerId: null,
    workshopName: null,
    workshopMobile: null,
    customerName: name,
    mobile,
    category: input.category,
    department: input.department,
    serviceType: input.serviceType,
    vehicleNumber: input.vehicleNumber.trim().toUpperCase(),
    vehicle: input.vehicle.trim(),
    brand: input.brand,
    model: input.model,
    year: input.year,
    fuel: input.fuel,
    issue: input.issue.trim(),
    location: input.location.trim(),
    preferredDate: input.preferredDate,
    preferredTime: input.preferredTime,
    photoCount: Math.max(0, Math.round(input.photoCount)),
    status: "New",
    assignment: null,
    vehicleReceivedAt: null,
    checklist: {
      repairItems: [],
      replaceItems: [],
      discount: 0,
      notes: "",
      sentAt: null,
      sentVersion: 0,
    },
    approval: emptyApproval(),
    payment: emptyPayment(),
    delivery: emptyDelivery(),
    timeline: [{ status: "New", at: now }],
    createdAt: now,
    updatedAt: now,
  };

  if (!replicaWrite(KEY, [enquiry, ...rows])) {
    return { ok: false, error: "The enquiry could not be saved. Please try again." };
  }
  return { ok: true, enquiry };
}

/* --------------------------------------------------------------- accept */

export function acceptEnquiry({
  partnerId,
  workshopName,
  workshopMobile,
  enquiryId,
  mode,
  employeeId,
  note,
}: {
  partnerId: string;
  workshopName: string;
  workshopMobile: string;
  enquiryId: string;
  mode: AssignmentMode;
  employeeId?: string | undefined;
  note?: string | undefined;
}): EnquiryResult {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry) return { ok: false, error: "That enquiry could not be found." };
  if (enquiry.partnerId && enquiry.partnerId !== partnerId) {
    return { ok: false, error: "Another workshop has already accepted this enquiry." };
  }
  if (mode !== "pickup" && mode !== "visit") {
    return { ok: false, error: "Choose pickup or workshop visit." };
  }

  const employee = employeeId
    ? (WORKSHOP_TEAM.find((item) => item.id === employeeId) ?? null)
    : null;
  if (mode === "pickup" && !employee) {
    return { ok: false, error: "Choose the employee who will pick up the vehicle." };
  }

  const now = new Date().toISOString();
  const changedStatus = enquiry.status !== "Accepted";
  const next: WorkshopEnquiry = {
    ...enquiry,
    partnerId,
    workshopName,
    workshopMobile,
    status: "Accepted",
    assignment: {
      mode,
      employeeId: employee?.id ?? null,
      employeeName: employee?.name ?? null,
      employeeMobile: employee?.mobile ?? null,
      note: (note ?? "").trim().slice(0, 300),
      acceptedAt: now,
    },
    updatedAt: now,
    timeline: changedStatus
      ? [...enquiry.timeline, { status: "Accepted", at: now }]
      : enquiry.timeline,
  };
  return replaceEnquiry(rows, next);
}

/* ----------------------------------------------------- vehicle received */

export function markVehicleReceived(partnerId: string, enquiryId: string): EnquiryResult {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry || enquiry.partnerId !== partnerId) {
    return { ok: false, error: "That enquiry is not assigned to this workshop." };
  }
  if (enquiry.status !== "Accepted") {
    return { ok: false, error: "Accept the enquiry before receiving the vehicle." };
  }
  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Vehicle Received",
    vehicleReceivedAt: now,
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Vehicle Received", at: now }],
  });
}

function editableEnquiry(
  partnerId: string,
  enquiryId: string,
): { rows: WorkshopEnquiry[]; enquiry: WorkshopEnquiry } | { error: string } {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry || enquiry.partnerId !== partnerId) {
    return { error: "That enquiry is not assigned to this workshop." };
  }
  if (enquiry.status !== "Vehicle Received" && enquiry.status !== "Estimate Sent") {
    return { error: "Receive the vehicle before building the checklist." };
  }
  if (enquiry.approval.approvedAt || enquiry.approval.rejectedAt) {
    return {
      error:
        "The customer has already responded, so this estimate is locked. It can no longer be edited.",
    };
  }
  return { rows, enquiry };
}

const lineId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/* -------------------------------------------------------- repair items */

export function addRepairItem(
  partnerId: string,
  enquiryId: string,
  input: { name: string; qty: number; cost: number },
): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter the repair item." };
  if (!Number.isFinite(input.qty) || input.qty < 1) {
    return { ok: false, error: "Quantity must be at least 1." };
  }
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return { ok: false, error: "Enter a valid labour cost." };
  }

  const line: EnquiryLine = {
    id: lineId("repair"),
    name,
    qty: Math.round(input.qty),
    cost: Math.round(input.cost),
  };
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    checklist: {
      ...state.enquiry.checklist,
      repairItems: [...state.enquiry.checklist.repairItems, line],
    },
    updatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------- replace items */

export function addReplaceItem(
  partnerId: string,
  enquiryId: string,
  input: { partId: string; qty: number },
): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };

  const part = MW_AUTO_PARTS.find((item) => item.id === input.partId);
  if (!part) return { ok: false, error: "Choose a part from MW Auto Parts." };
  if (!Number.isFinite(input.qty) || input.qty < 1) {
    return { ok: false, error: "Quantity must be at least 1." };
  }

  const line: EnquiryLine = {
    id: lineId("replace"),
    name: part.name,
    qty: Math.round(input.qty),
    cost: part.price,
    partId: part.id,
  };
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    checklist: {
      ...state.enquiry.checklist,
      replaceItems: [...state.enquiry.checklist.replaceItems, line],
    },
    updatedAt: new Date().toISOString(),
  });
}

export function removeEnquiryLine(
  partnerId: string,
  enquiryId: string,
  kind: "repair" | "replace",
  lineItemId: string,
): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };
  const checklist =
    kind === "repair"
      ? {
          ...state.enquiry.checklist,
          repairItems: state.enquiry.checklist.repairItems.filter((item) => item.id !== lineItemId),
        }
      : {
          ...state.enquiry.checklist,
          replaceItems: state.enquiry.checklist.replaceItems.filter(
            (item) => item.id !== lineItemId,
          ),
        };
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    checklist,
    updatedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------- totals */

export function estimateTotals(enquiry: WorkshopEnquiry) {
  const labour = enquiry.checklist.repairItems.reduce((sum, item) => sum + item.qty * item.cost, 0);
  const parts = enquiry.checklist.replaceItems.reduce((sum, item) => sum + item.qty * item.cost, 0);
  const discount = Math.min(Math.max(0, Math.round(enquiry.checklist.discount)), labour);
  return { labour, parts, discount, total: labour - discount + parts };
}

/* ------------------------------------------------------- discount/notes */

export function setEnquiryDiscount(
  partnerId: string,
  enquiryId: string,
  discount: number,
): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };
  if (!Number.isFinite(discount) || discount < 0) {
    return { ok: false, error: "Enter a valid discount." };
  }
  const { labour } = estimateTotals(state.enquiry);
  if (Math.round(discount) > labour) {
    return { ok: false, error: "The discount cannot be more than the labour total." };
  }
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    checklist: { ...state.enquiry.checklist, discount: Math.round(discount) },
    updatedAt: new Date().toISOString(),
  });
}

export function setEnquiryNotes(
  partnerId: string,
  enquiryId: string,
  notes: string,
): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    checklist: {
      ...state.enquiry.checklist,
      notes: notes.trim().slice(0, 600),
    },
    updatedAt: new Date().toISOString(),
  });
}

/* --------------------------------------------------------- send estimate */

export function sendEstimate(partnerId: string, enquiryId: string): EnquiryResult {
  const state = editableEnquiry(partnerId, enquiryId);
  if ("error" in state) return { ok: false, error: state.error };
  if (
    state.enquiry.checklist.repairItems.length === 0 &&
    state.enquiry.checklist.replaceItems.length === 0
  ) {
    return { ok: false, error: "Add at least one repair or replacement item first." };
  }
  const totals = estimateTotals(state.enquiry);
  if (state.enquiry.checklist.discount > totals.labour) {
    return { ok: false, error: "The discount cannot be more than the labour total." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(state.rows, {
    ...state.enquiry,
    status: "Estimate Sent",
    checklist: {
      ...state.enquiry.checklist,
      sentAt: now,
      sentVersion: state.enquiry.checklist.sentVersion + 1,
    },
    approval: emptyApproval(),
    payment: emptyPayment(),
    delivery: emptyDelivery(),
    updatedAt: now,
    timeline: [...state.enquiry.timeline, { status: "Estimate Sent", at: now }],
  });
}

/* ------------------------------------------------------ customer approval */

function customerEnquiry(enquiryId: string, mobile: string): WorkshopEnquiry | null {
  return (
    readAll().find(
      (row) =>
        row.id === enquiryId &&
        row.mobile.replace(/\s+/g, "") === mobile.trim().replace(/\s+/g, ""),
    ) ?? null
  );
}

/** Customer accepts the estimate; the demo SMS sends the fixed preview OTP. */
export function approveEnquiryEstimate(enquiryId: string, mobile: string): EnquiryResult {
  const rows = readAll();
  const enquiry = customerEnquiry(enquiryId, mobile);
  if (!enquiry) return { ok: false, error: "This estimate could not be found for your booking." };
  if (enquiry.status !== "Estimate Sent") {
    return { ok: false, error: "This estimate is not waiting for your approval." };
  }

  const totals = estimateTotals(enquiry);
  if (totals.total < 1) {
    return { ok: false, error: "The workshop estimate has no payable amount." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Approved",
    approval: {
      ...emptyApproval(),
      approvedAt: now,
      otpCode: MOCK_ENQUIRY_OTP,
      otpSentAt: now,
      lockedTotal: totals.total,
    },
    payment: emptyPayment(),
    delivery: emptyDelivery(),
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Approved", at: now }],
  });
}

/** Rejection is allowed until the workshop verifies the OTP and locks the job. */
export function rejectEnquiryEstimate(
  enquiryId: string,
  mobile: string,
  reason?: string | undefined,
): EnquiryResult {
  const rows = readAll();
  const enquiry = customerEnquiry(enquiryId, mobile);
  if (!enquiry) return { ok: false, error: "This estimate could not be found for your booking." };
  if (enquiry.status !== "Estimate Sent" && enquiry.status !== "Approved") {
    return { ok: false, error: "This estimate can no longer be rejected online." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Rejected",
    approval: {
      ...emptyApproval(),
      rejectedAt: now,
      rejectionReason: (reason ?? "Customer rejected the estimate.").trim().slice(0, 300),
    },
    payment: emptyPayment(),
    delivery: emptyDelivery(),
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Rejected", at: now }],
  });
}

/* ---------------------------------------------------------- OTP + payment */

/** Workshop checks the OTP the customer shared, then the amount is locked. */
export function verifyEnquiryOtp(partnerId: string, enquiryId: string, otp: string): EnquiryResult {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry || enquiry.partnerId !== partnerId) {
    return { ok: false, error: "That enquiry is not assigned to this workshop." };
  }
  if (enquiry.status !== "Approved" || !enquiry.approval.otpCode) {
    return { ok: false, error: "The customer has not approved this estimate yet." };
  }
  if (otp.trim() !== enquiry.approval.otpCode) {
    return { ok: false, error: "That OTP is incorrect. Ask the customer to read it again." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Estimate Locked",
    approval: {
      ...enquiry.approval,
      otpVerifiedAt: now,
      lockedTotal: enquiry.approval.lockedTotal ?? estimateTotals(enquiry).total,
    },
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Estimate Locked", at: now }],
  });
}

/** Called only after Razorpay confirms the signature on the server. */
export function confirmEnquiryPayment(
  enquiryId: string,
  mobile: string,
  paid: {
    orderId: string;
    paymentId: string;
    amount: number;
    provider?: "Razorpay" | "Preview" | undefined;
  },
): EnquiryResult {
  const rows = readAll();
  const enquiry = customerEnquiry(enquiryId, mobile);
  if (!enquiry) return { ok: false, error: "This booking could not be found." };
  if (enquiry.status !== "Estimate Locked") {
    return { ok: false, error: "The workshop must verify the OTP before payment." };
  }
  const expected = enquiry.approval.lockedTotal ?? estimateTotals(enquiry).total;
  if (Math.round(paid.amount) !== Math.round(expected)) {
    return {
      ok: false,
      error:
        "The paid amount does not match the locked estimate. Contact support with your payment ID.",
    };
  }

  const now = new Date().toISOString();
  const next: WorkshopEnquiry = {
    ...enquiry,
    status: "Paid",
    payment: {
      status: "Paid",
      provider: paid.provider ?? "Razorpay",
      orderId: paid.orderId,
      paymentId: paid.paymentId,
      amount: Math.round(expected),
      paidAt: now,
    },
    delivery: emptyDelivery(),
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Paid", at: now }],
  };
  const saved = replaceEnquiry(rows, next);
  if (!saved.ok) return saved;

  // Phase 4: a paid estimate with replacement parts immediately becomes a
  // fulfilment order in the Parts Portal. The helper is idempotent, so a
  // retried confirmation can never create a duplicate order.
  ensureWorkshopPartsOrder({
    id: next.id,
    workshopName: next.workshopName,
    workshopMobile: next.workshopMobile,
    vehicle: next.vehicle,
    vehicleNumber: next.vehicleNumber,
    location: next.location,
    parts: next.checklist.replaceItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      cost: item.cost,
    })),
  });
  return saved;
}

/* --------------------------------------------------- phase 4 · delivery */

/**
 * The workshop can declare the work complete only after every replacement
 * part has arrived. The Parts Portal marks its auto order Delivered first; the
 * workshop reads that status and the courier tracking ID from the same order.
 */
export function markReadyForDelivery(partnerId: string, enquiryId: string): EnquiryResult {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry || enquiry.partnerId !== partnerId) {
    return { ok: false, error: "That enquiry is not assigned to this workshop." };
  }
  if (enquiry.status !== "Paid") {
    return { ok: false, error: "The vehicle must be paid and received before delivery." };
  }

  if (enquiry.checklist.replaceItems.length > 0) {
    const order = partsOrderForEnquiry(enquiry.id);
    if (!order) {
      return {
        ok: false,
        error: "The automatic MW Auto Parts order is missing. Ask the parts desk to re-check it.",
      };
    }
    if (order.status !== "Delivered") {
      const tracking = order.trackingId ? ` Tracking ID ${order.trackingId}.` : "";
      return {
        ok: false,
        error: `The parts order is still ${order.status}.${tracking} The parts shop must mark it Delivered first.`,
      };
    }
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Ready for Delivery",
    delivery: { ...emptyDelivery(), ...enquiry.delivery, readyAt: now },
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Ready for Delivery", at: now }],
  });
}

/**
 * Customer confirms they inspected the vehicle; the fixed preview SMS OTP is
 * revealed so they can read it to the workshop at handover.
 */
export function shareFinalOtp(enquiryId: string, mobile: string): EnquiryResult {
  const rows = readAll();
  const enquiry = customerEnquiry(enquiryId, mobile);
  if (!enquiry) return { ok: false, error: "This booking could not be found." };
  if (enquiry.status !== "Ready for Delivery") {
    return { ok: false, error: "The workshop has not marked this vehicle ready for delivery yet." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    delivery: {
      ...emptyDelivery(),
      ...enquiry.delivery,
      finalOtpCode: MOCK_FINAL_OTP,
      finalOtpSentAt: now,
    },
    updatedAt: now,
  });
}

/** Workshop verifies the customer's final handover OTP and closes the job. */
export function verifyFinalOtp(partnerId: string, enquiryId: string, otp: string): EnquiryResult {
  const rows = readAll();
  const enquiry = rows.find((row) => row.id === enquiryId);
  if (!enquiry || enquiry.partnerId !== partnerId) {
    return { ok: false, error: "That enquiry is not assigned to this workshop." };
  }
  if (enquiry.status !== "Ready for Delivery") {
    return { ok: false, error: "This job is not waiting for a final delivery OTP." };
  }
  if (!enquiry.delivery.finalOtpCode || !enquiry.delivery.finalOtpSentAt) {
    return { ok: false, error: "The customer has not shared the final OTP yet." };
  }
  if (otp.trim() !== enquiry.delivery.finalOtpCode) {
    return { ok: false, error: "That final OTP is incorrect. Ask the customer to read it again." };
  }

  const now = new Date().toISOString();
  return replaceEnquiry(rows, {
    ...enquiry,
    status: "Delivered",
    delivery: {
      ...emptyDelivery(),
      ...enquiry.delivery,
      finalOtpVerifiedAt: now,
      deliveredAt: now,
    },
    updatedAt: now,
    timeline: [...enquiry.timeline, { status: "Delivered", at: now }],
  });
}
