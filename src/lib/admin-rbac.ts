/**
 * Role-based access control for the master control room.
 *
 * One policy file decides what a signed-in person may see and change. The CRM
 * data layer calls these helpers before every write, so access is enforced
 * where the mutation happens rather than only by hiding buttons.
 *
 * Scope rules:
 *   super_admin  every department, every employee, the full audit log
 *   manager      every case in their department, can assign work, reads the log
 *   executive    reads their department's queue, may only change the cases
 *                assigned to them
 *   read_only    may read their department's cases, may not change anything
 *
 * Departments are the visibility boundary: a Finance employee never sees
 * Service, Franchise or Sales work. Roles decide what may be done with it.
 */
import type { CaseType } from "./admin-crm";

export const DEPARTMENTS = [
  "Finance",
  "Insurance",
  "Service",
  "Sales",
  "Operations",
  "IT",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const ROLES = ["super_admin", "manager", "executive", "read_only"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  executive: "Executive",
  read_only: "Read-Only",
};

/** One-line description used in the employee form and the audit log. */
export const ROLE_HINT: Record<Role, string> = {
  super_admin: "Full control: every department, the employee directory and the audit log.",
  manager: "Every case in their department. Can assign work and open the audit log.",
  executive: "Only the cases assigned to them. Can progress status and add notes.",
  read_only: "May read their department's cases. Cannot change anything.",
};

/**
 * The business lines each desk owns. A Finance employee never sees Service or
 * Franchise work, and cannot be assigned it either.
 */
export const DEPARTMENT_CASE_TYPES: Record<Department, CaseType[]> = {
  Finance: ["Finance"],
  Insurance: ["Insurance"],
  Service: ["Service", "Parts Order", "Decor Order"],
  Sales: ["Sell", "Exchange", "Test Drive", "Vehicle Enquiry"],
  Operations: ["Franchise", "Scrap"],
  IT: [],
};

export const DEPARTMENT_HINT: Record<Department, string> = {
  Finance: "Loan files, approvals and disbursal",
  Insurance: "Policy quotes, renewals and claims",
  Service: "Workshop, parts orders and decor jobs",
  Sales: "Buy, sell, exchange and test drives",
  Operations: "Franchise, scrap and partnerships",
  IT: "Systems, access and tooling",
};

export type Permission =
  | "case.view.department"
  | "case.view.assigned"
  | "case.view.all"
  | "case.update_status"
  | "case.assign"
  | "case.note"
  | "employee.view"
  | "employee.manage"
  | "audit.view";

const PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "case.view.department",
    "case.view.assigned",
    "case.view.all",
    "case.update_status",
    "case.assign",
    "case.note",
    "employee.view",
    "employee.manage",
    "audit.view",
  ],
  manager: [
    "case.view.department",
    "case.view.assigned",
    "case.update_status",
    "case.assign",
    "case.note",
    "employee.view",
    "audit.view",
  ],
  // Executives read the whole desk queue, but may only change their own work.
  executive: ["case.view.department", "case.update_status", "case.note"],
  read_only: ["case.view.department"],
};

/** The signed-in person, as the data layer sees them. */
export type Actor = {
  /** Employee id (EMP-1001) or OWNER-1 for the environment credential. */
  id: string;
  name: string;
  email: string;
  role: Role;
  /** null only for a super admin, who is not tied to one desk. */
  department: Department | null;
};

export const can = (actor: Actor, permission: Permission): boolean =>
  PERMISSIONS[actor.role].includes(permission);

export const isSuperAdmin = (actor: Actor): boolean => actor.role === "super_admin";

/** Case fields the policy needs — keeps this module free of CRM imports. */
export type CaseScope = { type: CaseType; assignedTo: string | null };

/** Which desk owns a business line. */
export function departmentForCaseType(type: CaseType): Department | null {
  for (const department of DEPARTMENTS) {
    if (DEPARTMENT_CASE_TYPES[department].includes(type)) return department;
  }
  return null;
}

/** A department can handle a business line if it owns it or has no desk limit. */
export function departmentCovers(department: Department, type: CaseType): boolean {
  return DEPARTMENT_CASE_TYPES[department].includes(type);
}

/**
 * Visibility is the union of the role's scope: super admins see everything,
 * managers and read-only users see their department, executives see only their
 * own work.
 */
export function canViewCase(actor: Actor, kase: CaseScope): boolean {
  if (isSuperAdmin(actor)) return true;
  if (can(actor, "case.view.department")) {
    return actor.department ? departmentCovers(actor.department, kase.type) : false;
  }
  return kase.assignedTo === actor.id;
}

/** True when the role may open work that is not theirs inside the department. */
export const canReadWholeDesk = (actor: Actor): boolean =>
  isSuperAdmin(actor) || can(actor, "case.view.department");

export function canEditCase(actor: Actor, kase: CaseScope): boolean {
  if (!canViewCase(actor, kase)) return false;
  if (!can(actor, "case.update_status")) return false;
  if (actor.role === "executive") return kase.assignedTo === actor.id;
  return true;
}

export const canAssignCase = (actor: Actor, kase: CaseScope): boolean =>
  can(actor, "case.assign") && canViewCase(actor, kase);

/** Case types a person can filter by — the desk's lines, or all for a super admin. */
export function visibleCaseTypes(actor: Actor): CaseType[] {
  if (isSuperAdmin(actor)) return Object.values(DEPARTMENT_CASE_TYPES).flat();
  if (can(actor, "case.view.department") && actor.department) {
    return DEPARTMENT_CASE_TYPES[actor.department];
  }
  return [];
}

/** Human description of what a person is allowed to see, for banners. */
export function scopeLabel(actor: Actor): string {
  if (isSuperAdmin(actor)) return "All departments";
  if (actor.department) return `${actor.department} desk only`;
  return "Assigned to me only";
}

/** Toggle availability: "All tasks" needs department-level visibility. */
export const canViewAllTasks = (actor: Actor): boolean => canReadWholeDesk(actor);

/** Every change is attributed, so the log always names a person and a role. */
export function actorFromSession(session: {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department: Department | null;
}): Actor {
  return {
    id: session.employeeId,
    name: session.name,
    email: session.email,
    role: session.role,
    department: session.department,
  };
}
