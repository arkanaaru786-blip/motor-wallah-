/**
 * Partner portal session — one device-local session per portal.
 *
 * Deliberately separate from the dealer and admin sessions: a workshop account
 * can never open the control room or the parts portal. The session stores the
 * partner id and type, and is re-checked against the registry on every load so
 * a disabled account (or a removed one) loses access immediately.
 *
 * Failed sign-ins are throttled per device, like the admin gate: five wrong
 * passwords in a row lock that ID for a minute.
 */
import { useSyncExternalStore } from "react";

import {
  findPartner,
  getPartnerType,
  verifyPartnerSignIn,
  type Partner,
  type PartnerType,
} from "@/lib/partners";

const SESSION_KEYS: Record<PartnerType, string> = {
  workshop: "mw_workshop_session",
  parts: "mw_parts_session",
  decor: "mw_decor_session",
};

/** A partner stays signed in for 12 hours. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const ATTEMPTS_KEY = "mw_partner_attempts";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export type PartnerSession = {
  partnerId: string;
  type: PartnerType;
  name: string;
  business: string;
  email: string;
  mobile: string;
  city: string;
  issuedAt: string;
  expiresAt: number;
};

export type PartnerAuthSnapshot = {
  /** false during SSR / the hydration pass. */
  ready: boolean;
  session: PartnerSession | null;
};

const SIGNED_OUT: PartnerAuthSnapshot = { ready: false, session: null };

const listeners: Record<PartnerType, Set<() => void>> = {
  workshop: new Set(),
  parts: new Set(),
  decor: new Set(),
};

const snapshots: Record<PartnerType, PartnerAuthSnapshot> = {
  workshop: SIGNED_OUT,
  parts: SIGNED_OUT,
  decor: SIGNED_OUT,
};

function emit(type: PartnerType) {
  for (const listener of [...listeners[type]]) listener();
}

function readStored(type: PartnerType): PartnerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SESSION_KEYS[type]) ?? "null",
    ) as PartnerSession | null;
    if (!parsed || typeof parsed.partnerId !== "string") return null;
    if (parsed.type !== type) return null;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;

    // The registry is the source of truth: a disabled partner, a deleted
    // account or a different type must not keep an old session alive.
    const partner = findPartner(parsed.partnerId);
    if (!partner || partner.status !== "Active" || partner.type !== type) return null;
    return {
      ...parsed,
      name: partner.name,
      business: partner.business,
      mobile: partner.mobile,
      city: partner.city,
    };
  } catch {
    return null;
  }
}

function refresh(type: PartnerType) {
  const session = readStored(type);
  snapshots[type] = { ready: true, session };
  if (!session) {
    try {
      window.localStorage.removeItem(SESSION_KEYS[type]);
    } catch {
      /* storage blocked — nothing to clean up */
    }
  }
  emit(type);
}

function writeSession(type: PartnerType, session: PartnerSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEYS[type], JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEYS[type]);
  } catch {
    /* storage blocked — the caller still gets the in-memory session */
  }
  refresh(type);
}

export function subscribeToPartnerSession(type: PartnerType, listener: () => void): () => void {
  listeners[type].add(listener);
  return () => listeners[type].delete(listener);
}

export function partnerSessionSnapshot(type: PartnerType): PartnerAuthSnapshot {
  if (typeof window === "undefined") return SIGNED_OUT;
  if (!snapshots[type].ready) refresh(type);
  return snapshots[type];
}

/** Synchronous session read for route guards. */
export function currentPartner(type: PartnerType): PartnerSession | null {
  return partnerSessionSnapshot(type).session;
}

export function usePartnerSession(type: PartnerType): PartnerAuthSnapshot {
  return useSyncExternalStore(
    (listener) => subscribeToPartnerSession(type, listener),
    () => partnerSessionSnapshot(type),
    () => SIGNED_OUT,
  );
}

/* ------------------------------------------------------------- attempts */

type AttemptRecord = { failed: number; lockedUntil: number };

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

function writeAttempts(all: Record<string, AttemptRecord>) {
  try {
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    /* attempt tracking is best-effort */
  }
}

function lockedSeconds(key: string): number {
  const record = readAttempts()[key];
  if (!record || record.lockedUntil <= Date.now()) return 0;
  return Math.ceil((record.lockedUntil - Date.now()) / 1000);
}

function registerFailure(key: string): { locked: boolean; remaining: number } {
  const all = readAttempts();
  const current = all[key] ?? { failed: 0, lockedUntil: 0 };
  const failed = current.failed + 1;
  const locked = failed >= MAX_ATTEMPTS;
  all[key] = locked ? { failed: 0, lockedUntil: Date.now() + LOCK_MS } : { failed, lockedUntil: 0 };
  writeAttempts(all);
  return { locked, remaining: Math.max(0, MAX_ATTEMPTS - failed) };
}

function clearFailures(key: string) {
  const all = readAttempts();
  if (!(key in all)) return;
  delete all[key];
  writeAttempts(all);
}

/* --------------------------------------------------------------- sign in */

export type PartnerSignInOutcome = { ok: true } | { ok: false; error: string };

export async function signInPartner(
  type: PartnerType,
  id: string,
  password: string,
): Promise<PartnerSignInOutcome> {
  const key = `${type}:${id.trim().toUpperCase()}`;
  const seconds = lockedSeconds(key);
  if (seconds > 0) {
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${seconds}s.`,
    };
  }

  const result = await verifyPartnerSignIn(type, id, password);
  if (!result.ok) {
    const attempt = registerFailure(key);
    if (attempt.locked) {
      return {
        ok: false,
        error: `Too many failed attempts. Locked for ${Math.round(LOCK_MS / 1000)}s.`,
      };
    }
    const suffix = ` ${attempt.remaining} attempt${attempt.remaining === 1 ? "" : "s"} left.`;
    return { ok: false, error: `${result.error}${suffix}` };
  }

  clearFailures(key);
  const { partner } = result;
  const now = Date.now();
  writeSession(type, toSession(partner, now));
  return { ok: true };
}

function toSession(partner: Partner, now: number): PartnerSession {
  return {
    partnerId: partner.id,
    type: partner.type,
    name: partner.name,
    business: partner.business,
    email: partner.email,
    mobile: partner.mobile,
    city: partner.city,
    issuedAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  };
}

export function signOutPartner(type: PartnerType) {
  writeSession(type, null);
}

/** Used after an admin approves or resets an account. */
export function reloadPartnerSession(type: PartnerType) {
  refresh(type);
}

/** The login heading a portal uses for its own type. */
export const partnerPortalLabel = (type: PartnerType) => getPartnerType(type).label;
