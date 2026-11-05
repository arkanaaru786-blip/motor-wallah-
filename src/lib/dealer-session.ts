/**
 * Dealer portal session.
 *
 * Deliberately separate from the staff/admin session: a dealer is not a staff
 * member and must never inherit the control room. The session is device-local
 * (never replicated) and carries the dealer's category, which is what every
 * panel in the portal filters by.
 *
 * The category in the session is re-checked against the registry on load: if an
 * admin rebinds the dealer to a different category, or disables them, the stale
 * session is dropped instead of keeping the old access.
 */
import { useSyncExternalStore } from "react";

import { isDealerCategory, type DealerCategoryId } from "@/lib/dealer-categories";
import { findDealer, verifyDealerSignIn } from "@/lib/dealers";

const KEY = "mw_dealer_session";

/** A dealer stays signed in for 12 hours. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type DealerSession = {
  dealerId: string;
  name: string;
  showroom: string;
  email: string;
  category: DealerCategoryId;
  issuedAt: string;
  expiresAt: number;
};

export type DealerAuthSnapshot = {
  /** false during SSR / the hydration pass. */
  ready: boolean;
  session: DealerSession | null;
};

const SIGNED_OUT: DealerAuthSnapshot = { ready: false, session: null };

const listeners = new Set<() => void>();
let snapshot: DealerAuthSnapshot = SIGNED_OUT;

function emit() {
  for (const listener of [...listeners]) listener();
}

function readStored(): DealerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as DealerSession | null;
    if (!parsed || typeof parsed.dealerId !== "string") return null;
    if (!isDealerCategory(parsed.category)) return null;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;

    // Re-validate against the registry: a disabled dealer, a re-bound category
    // or a deleted account must not keep an old session alive.
    const dealer = findDealer(parsed.dealerId);
    if (!dealer || dealer.status !== "Active") return null;
    if (dealer.category !== parsed.category) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { ...parsed, category: dealer.category };
  } catch {
    return null;
  }
}

function refresh() {
  const session = readStored();
  snapshot = { ready: true, session };
  if (!session) {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* storage blocked — nothing to clean up */
    }
  }
  emit();
}

function writeSession(session: DealerSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — the caller still gets the in-memory session */
  }
  refresh();
}

export function subscribeToDealerSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dealerSessionSnapshot(): DealerAuthSnapshot {
  if (typeof window === "undefined") return SIGNED_OUT;
  if (!snapshot.ready) refresh();
  return snapshot;
}

/** Synchronous session read for route guards. */
export function currentDealer(): DealerSession | null {
  return dealerSessionSnapshot().session;
}

export function useDealerSession(): DealerAuthSnapshot {
  return useSyncExternalStore(subscribeToDealerSession, dealerSessionSnapshot, () => SIGNED_OUT);
}

export type SignInOutcome = { ok: true } | { ok: false; error: string };

export async function signInDealer(email: string, password: string): Promise<SignInOutcome> {
  const result = await verifyDealerSignIn(email, password);
  if (!result.ok) return { ok: false, error: result.error };

  const { dealer } = result;
  const now = Date.now();
  writeSession({
    dealerId: dealer.id,
    name: dealer.name,
    showroom: dealer.showroom,
    email: dealer.email,
    category: dealer.category,
    issuedAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  });
  return { ok: true };
}

export function signOutDealer() {
  writeSession(null);
}

/** Used after an admin re-binds or approves an account. */
export function reloadDealerSession() {
  refresh();
}
