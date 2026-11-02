import { useSyncExternalStore } from "react";
import {
  createPasswordCredential,
  cryptoAvailable,
  safeEqual,
  sha256Hex,
  validatePasswordStrength,
  verifyPasswordCredential,
} from "./admin-crypto";
import { verifyEmployeeSignIn } from "./admin-crm";
import { ROLES, ROLE_LABEL, type Department, type Role } from "./admin-rbac";

/**
 * Master Admin authentication.
 *
 * There is no server in this project, so the admin gate is a real, working
 * email + password check on the device, built on the same storage patterns as
 * the customer session in `account-store.ts`.
 *
 * Where the password lives (never in the source):
 *   1. Environment — VITE_MASTER_ADMIN_EMAIL + VITE_MASTER_ADMIN_PASSWORD_HASH
 *      (SHA-256 of the password). This is the production path: set both in the
 *      deploy environment and no credential ever touches the repository.
 *   2. The admin database — an account enrolled through the first-run setup
 *      screen, stored as a salted PBKDF2-SHA256 hash (150k iterations). The
 *      plaintext password is never written anywhere.
 *
 * Employees sign in with the work email and temporary password set for them in
 * the directory; their session carries the employee id, role and department,
 * which is what the RBAC policy in `admin-rbac.ts` checks on every write.
 *
 * Honest limitation: this is a browser-side gate. It keeps the control room
 * behind a credential and out of the public nav, but it is not a substitute for
 * server-side authorization once the panel manages data other people can read.
 */

const ACCOUNTS_KEY = "mw_admin_accounts";
const SESSION_KEY = "mw_admin_session";

/** A signed-in admin is asked to sign in again after 8 hours or 30 idle minutes. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const IDLE_TTL_MS = 30 * 60 * 1000;

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export type AdminAccount = {
  email: string;
  name: string;
  role: Role;
  /** base64 PBKDF2 salt */
  salt: string;
  /** base64 PBKDF2-SHA256 derived key */
  hash: string;
  iterations: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminSession = {
  /** Employee id (EMP-1001) or OWNER-1 for the owner credential. */
  employeeId: string;
  email: string;
  name: string;
  role: Role;
  /** null only for a super admin, who works across every desk. */
  department: Department | null;
  /** Where the credential that signed this session in came from. */
  source: "environment" | "database" | "employee";
  issuedAt: string;
  lastSeenAt: number;
  expiresAt: number;
};

export type AdminAuthSnapshot = {
  /** false during SSR / hydration, before the stored session is read. */
  ready: boolean;
  session: AdminSession | null;
  /** true when no administrator exists yet — the panel offers first-run setup. */
  needsSetup: boolean;
};

const SIGNED_OUT: AdminAuthSnapshot = { ready: false, session: null, needsSetup: false };

/* ------------------------------------------------------------------ env */

type EnvCredential = { email: string; passwordHash: string | null; password: string | null };

function readEnvCredential(): EnvCredential | null {
  const email = (import.meta.env["VITE_MASTER_ADMIN_EMAIL"] ?? "").trim().toLowerCase();
  if (!email) return null;
  const hash = (import.meta.env["VITE_MASTER_ADMIN_PASSWORD_HASH"] ?? "").trim();
  const password = import.meta.env["VITE_MASTER_ADMIN_PASSWORD"] ?? "";
  if (!hash && !password) return null;
  return {
    email,
    passwordHash: hash ? normalizeHexHash(hash) : null,
    password: password ? password : null,
  };
}

function normalizeHexHash(value: string): string {
  const raw = value
    .toLowerCase()
    .replace(/^sha256:/, "")
    .trim();
  return raw;
}

/* --------------------------------------------------------------- storage */

function readAccounts(): Record<string, AdminAccount> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    // Phase 1 accounts carried role "owner"; they are super admins now.
    const accounts = parsed as Record<string, AdminAccount & { role: string }>;
    for (const account of Object.values(accounts)) {
      if (!ROLES.includes(account.role as Role)) account.role = "super_admin";
    }
    return accounts as Record<string, AdminAccount>;
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, AdminAccount>): boolean {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    return true;
  } catch {
    return false;
  }
}

function readSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SESSION_KEY) ?? "null",
    ) as AdminSession | null;
    if (!parsed || typeof parsed !== "object" || typeof parsed.email !== "string") return null;
    // Sessions written before RBAC existed have no employee id or valid role,
    // so they are dropped and the person signs in again.
    if (typeof parsed.employeeId !== "string") return null;
    if (!ROLES.includes(parsed.role as Role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: AdminSession | null): boolean {
  try {
    if (session === null) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- attempts */

type AttemptRecord = { failed: number; lockedUntil: number };
const ATTEMPTS_KEY = "mw_admin_attempts";

function readAttempts(): Record<string, AttemptRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? "{}") as Record<
      string,
      AttemptRecord
    >;
  } catch {
    return {};
  }
}

function registerFailure(email: string): { locked: boolean; remaining: number } {
  const all = readAttempts();
  const current = all[email] ?? { failed: 0, lockedUntil: 0 };
  const failed = current.failed + 1;
  const locked = failed >= MAX_ATTEMPTS;
  all[email] = locked
    ? { failed: 0, lockedUntil: Date.now() + LOCK_MS }
    : { failed, lockedUntil: 0 };
  try {
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    /* attempt tracking is best-effort */
  }
  return { locked, remaining: Math.max(0, MAX_ATTEMPTS - failed) };
}

function clearFailures(email: string) {
  const all = readAttempts();
  if (!(email in all)) return;
  delete all[email];
  try {
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- snapshots */

function computeSnapshot(): AdminAuthSnapshot {
  const session = readSession();
  const env = readEnvCredential();
  const accounts = Object.keys(readAccounts()).length > 0;
  return {
    ready: true,
    session: session && !isExpired(session) ? touchIdle(session) : null,
    needsSetup: !env && !accounts,
  };
}

function isExpired(session: AdminSession): boolean {
  const now = Date.now();
  return now >= session.expiresAt || now - session.lastSeenAt > IDLE_TTL_MS;
}

/**
 * Keeps the idle timer alive while the panel is in use without writing on every
 * event — the timestamp is refreshed in storage at most once a minute.
 */
function touchIdle(session: AdminSession): AdminSession {
  const now = Date.now();
  if (now - session.lastSeenAt < 60_000) return session;
  const next: AdminSession = { ...session, lastSeenAt: now };
  writeSession(next);
  return next;
}

let snapshot: AdminAuthSnapshot = SIGNED_OUT;
if (typeof window !== "undefined") snapshot = computeSnapshot();

const listeners = new Set<() => void>();

function emit() {
  snapshot = computeSnapshot();
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SESSION_KEY || event.key === ACCOUNTS_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const getSnapshot = () => snapshot;
const getServerSnapshot = (): AdminAuthSnapshot => SIGNED_OUT;

/** Missing-session status for route guards, which run before React renders. */
function noopSubscribe() {
  return () => {};
}

export function useAdminSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `true` once the panel has read storage, so guards never guess during SSR. */
export function useAdminReady() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------------- API */

/** Synchronous guard read — returns null when absent, expired or idle. */
export function currentAdmin(): AdminSession | null {
  const session = readSession();
  if (!session) return null;
  if (isExpired(session)) {
    writeSession(null);
    return null;
  }
  return session;
}

export function adminNeedsSetup(): boolean {
  return !readEnvCredential() && Object.keys(readAccounts()).length === 0;
}

export function envAdminEmail(): string | null {
  return readEnvCredential()?.email ?? null;
}

export type SignInResult = { ok: true; session: AdminSession } | { ok: false; error: string };

export async function signInAdmin(emailInput: string, password: string): Promise<SignInResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { ok: false, error: "Enter your administrator email." };
  if (!password) return { ok: false, error: "Enter your password." };

  const attempts = readAttempts()[email];
  if (attempts && attempts.lockedUntil > Date.now()) {
    const seconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    return { ok: false, error: `Too many failed attempts. Try again in ${seconds}s.` };
  }

  if (!cryptoAvailable()) {
    return {
      ok: false,
      error: "This browser cannot verify a password securely. Try another browser.",
    };
  }

  const env = readEnvCredential();
  let verified: SignInResult | null = null;

  // 1. The deployment's own credential — always a super admin.
  if (env && env.email === email) {
    const matchesHash = env.passwordHash
      ? safeEqual(await sha256Hex(password), env.passwordHash)
      : false;
    const matchesPlain = env.password ? safeEqual(password, env.password) : false;
    if (matchesHash || matchesPlain) {
      verified = {
        ok: true,
        session: await startSession({
          employeeId: "OWNER-1",
          email,
          name: splitName(email, "Administrator"),
          role: "super_admin",
          department: null,
          source: "environment",
        }),
      };
    }
  }

  // 2. An owner account enrolled in the admin database on first run.
  if (!verified) {
    const account = readAccounts()[email];
    if (account) {
      const matches = await verifyPasswordCredential(password, {
        salt: account.salt,
        hash: account.hash,
        iterations: account.iterations,
      });
      if (matches) {
        const accounts = readAccounts();
        accounts[email] = { ...account, lastLoginAt: new Date().toISOString() };
        writeAccounts(accounts);
        verified = {
          ok: true,
          session: await startSession({
            employeeId: "OWNER-1",
            email: account.email,
            name: account.name,
            role: account.role,
            department: null,
            source: "database",
          }),
        };
      }
    }
  }

  // 3. An employee from the directory, with the role and desk on their record.
  if (!verified) {
    const staff = await verifyEmployeeSignIn(email, password);
    if (staff.ok) {
      verified = {
        ok: true,
        session: await startSession({
          employeeId: staff.employee.id,
          email: staff.employee.email,
          name: staff.employee.name,
          role: staff.employee.role,
          department: staff.employee.department,
          source: "employee",
        }),
      };
    }
  }

  if (!verified) {
    const result = registerFailure(email);
    return {
      ok: false,
      error: result.locked
        ? `Too many failed attempts. Locked for ${Math.round(LOCK_MS / 1000)}s.`
        : `Email or password is incorrect. ${result.remaining} attempt${
            result.remaining === 1 ? "" : "s"
          } left.`,
    };
  }

  clearFailures(email);
  return verified;
}

async function startSession(
  identity: Omit<AdminSession, "issuedAt" | "lastSeenAt" | "expiresAt">,
): Promise<AdminSession> {
  const now = Date.now();
  const session: AdminSession = {
    ...identity,
    issuedAt: new Date(now).toISOString(),
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  writeSession(session);
  emit();
  return session;
}

function splitName(email: string, fallback: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length ? words.join(" ") : fallback;
}

export function signOutAdmin() {
  writeSession(null);
  emit();
}

/* ------------------------------------------------------- first-run setup */

export function validateNewPassword(password: string, confirm: string): string | null {
  const weak = validatePasswordStrength(password);
  if (weak) return weak;
  if (password !== confirm) return "Both passwords must match.";
  return null;
}

export async function enrollAdmin(input: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}): Promise<SignInResult> {
  if (!cryptoAvailable()) {
    return { ok: false, error: "This browser cannot store a password securely." };
  }
  if (readEnvCredential()) {
    return {
      ok: false,
      error:
        "Administrator sign-in is managed by the deployment environment. Use those credentials.",
    };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Enter the administrator name." };

  const accounts = readAccounts();
  if (accounts[email])
    return { ok: false, error: "An administrator with that email already exists." };

  const credential = await createPasswordCredential(input.password);
  const account: AdminAccount = {
    email,
    name,
    role: input.role ?? "super_admin",
    salt: credential.salt,
    hash: credential.hash,
    iterations: credential.iterations,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  accounts[email] = account;
  if (!writeAccounts(accounts)) {
    return { ok: false, error: "This browser blocked storage, so the account could not be saved." };
  }
  return {
    ok: true,
    session: await startSession({
      employeeId: "OWNER-1",
      email,
      name,
      role: account.role,
      department: null,
      source: "database",
    }),
  };
}

/** Human labels for the credential source shown in the panel footer. */
export const ADMIN_SOURCE_LABEL: Record<AdminSession["source"], string> = {
  environment: "Environment credential",
  database: "Owner account",
  employee: "Employee directory",
};

/** Human label for the signed-in role, used in the shell header. */
export const sessionRoleLabel = (session: AdminSession): string =>
  `${ROLE_LABEL[session.role]}${session.department ? ` · ${session.department}` : ""}`;
