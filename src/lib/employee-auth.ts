import { useSyncExternalStore } from "react";

import { ensureAdminDatabase, verifyEmployeeSignIn, type AdminEmployee } from "./admin-crm";
import { type Actor, type Department, type Role } from "./admin-rbac";
import { deskForEmployee, type DeskKey } from "./employee-desk";

/**
 * Employee sign-in for the Universal Employee Dashboard (/employee).
 *
 * This is a *separate* session from the master admin one: an employee must not
 * inherit the control room, and an admin session must not silently open a desk.
 *
 * The credential is the one the admin set in the Employee Directory — verified
 * with the same salted PBKDF2 hash the control room uses. The desk an employee
 * may open is derived from the department (and category) the admin assigned and
 * is stored in the session, so the dashboard never asks which board to show.
 *
 * Honest limitation, same as the control room: this is a browser-side gate. The
 * data layer in `employee-desk.ts` re-checks the desk on every read and write,
 * but hard isolation between departments needs the desk collections behind
 * database row level security — see the note in that file.
 */
const SESSION_KEY = "mw_employee_session";

/** A desk session lasts a working day, or 45 idle minutes. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const IDLE_TTL_MS = 45 * 60 * 1000;

export type EmployeeSession = {
  employeeId: string;
  name: string;
  email: string;
  department: Department;
  category: string | null;
  role: Role;
  /** null when the department has no employee desk (Operations, IT). */
  desk: DeskKey | null;
  /** A seeded demo employee without a password; clearly marked in the UI. */
  demo: boolean;
  issuedAt: string;
  lastSeenAt: number;
  expiresAt: number;
};

export type EmployeeAuthSnapshot = {
  ready: boolean;
  session: EmployeeSession | null;
};

const SIGNED_OUT: EmployeeAuthSnapshot = { ready: false, session: null };

function readSession(): EmployeeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SESSION_KEY) ?? "null",
    ) as EmployeeSession | null;
    if (!parsed || typeof parsed.employeeId !== "string" || typeof parsed.email !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: EmployeeSession | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (session === null) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

function isExpired(session: EmployeeSession): boolean {
  const now = Date.now();
  return now >= session.expiresAt || now - session.lastSeenAt > IDLE_TTL_MS;
}

function touchIdle(session: EmployeeSession): EmployeeSession {
  const now = Date.now();
  if (now - session.lastSeenAt < 60_000) return session;
  const next = { ...session, lastSeenAt: now };
  writeSession(next);
  return next;
}

let snapshot: EmployeeAuthSnapshot = SIGNED_OUT;
if (typeof window !== "undefined") {
  const stored = readSession();
  snapshot = {
    ready: true,
    session: stored && !isExpired(stored) ? touchIdle(stored) : null,
  };
}

const listeners = new Set<() => void>();

function emit() {
  const stored = readSession();
  snapshot = {
    ready: true,
    session: stored && !isExpired(stored) ? touchIdle(stored) : null,
  };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SESSION_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const noop = () => () => {};

export function useEmployeeSession() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SIGNED_OUT,
  );
}

/** `true` once storage has been read, so guards never guess during SSR. */
export function useEmployeeReady() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Synchronous session read for route guards. */
export function currentEmployee(): EmployeeSession | null {
  const session = readSession();
  if (!session) return null;
  if (isExpired(session)) {
    writeSession(null);
    return null;
  }
  return session;
}

/** The actor the desk policy checks — department and category included. */
export function employeeActor(session: EmployeeSession): Actor & { category: string | null } {
  return {
    id: session.employeeId,
    name: session.name,
    email: session.email,
    role: session.role,
    department: session.department,
    category: session.category,
  };
}

function startSession(employee: AdminEmployee, demo: boolean): EmployeeSession {
  const now = Date.now();
  const session: EmployeeSession = {
    employeeId: employee.id,
    name: employee.name,
    email: employee.email,
    department: employee.department,
    category: employee.category ?? null,
    role: employee.role,
    desk: deskForEmployee(employee.department, employee.category),
    demo,
    issuedAt: new Date(now).toISOString(),
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  writeSession(session);
  emit();
  return session;
}

export type EmployeeSignInResult =
  { ok: true; session: EmployeeSession } | { ok: false; error: string };

/** Email + password, verified against the Employee Directory credential. */
export async function signInEmployee(
  email: string,
  password: string,
): Promise<EmployeeSignInResult> {
  if (!email.trim()) return { ok: false, error: "Enter your work email or employee ID." };
  if (!password) return { ok: false, error: "Enter your password." };

  const directory = ensureAdminDatabase().employees;
  const byId = directory.find((item) => item.id.toLowerCase() === email.trim().toLowerCase());
  const target = byId?.email ?? email.trim();
  const result = await verifyEmployeeSignIn(target, password);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, session: startSession(result.employee, false) };
}

/**
 * A seeded demo employee has no password (the admin never set one), so this
 * door only opens for a record with no credential. It exists so the preview can
 * be inspected desk by desk; a real employee created in the directory always
 * signs in with a password.
 */
export function signInDemoDesk(employeeId: string): EmployeeSignInResult {
  const employee = ensureAdminDatabase().employees.find((item) => item.id === employeeId);
  if (!employee) return { ok: false, error: "That demo account no longer exists." };
  if (employee.credential) {
    return { ok: false, error: "This employee has a password. Sign in with it instead." };
  }
  if (employee.status !== "Active") {
    return { ok: false, error: "That employee account is disabled." };
  }
  const asManager =
    employee.role === "read_only" ? { ...employee, role: "manager" as const } : employee;
  return { ok: true, session: startSession(asManager, true) };
}

export function signOutEmployee(): void {
  writeSession(null);
  emit();
}

/** Seeded employees with no password, offered as one-click desk previews. */
export function demoDeskAccounts(): AdminEmployee[] {
  if (typeof window === "undefined") return [];
  return ensureAdminDatabase().employees.filter(
    (item) =>
      !item.credential &&
      item.status === "Active" &&
      deskForEmployee(item.department, item.category) !== null,
  );
}

/** Payroll-safe label for the signed-in desk. */
export function employeeDeskLabel(session: EmployeeSession): string {
  const seat = session.category ? ` · ${session.category}` : "";
  return `${session.department}${seat}`;
}
