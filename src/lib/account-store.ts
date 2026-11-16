import { useSyncExternalStore } from "react";

import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { supabaseClient } from "@/lib/supabase";

/**
 * Customer accounts (Supabase-backed profiles, mock OTP).
 *
 * Profiles are persisted in Supabase `app_records` under the visitor's
 * anonymous session, so the account survives clearing the browser, while the
 * signed-in session itself stays on the device (`mw_customer_session`) — a
 * session is not something to replicate to other tabs' devices. Verification
 * is still a fixed demo OTP because no SMS provider is wired up; the UI says
 * so plainly instead of pretending a number was verified by SMS.
 *
 * There are no Buyer / Seller roles — every account is simply a customer.
 */
export type CustomerProfile = {
  /** 10-digit Indian mobile number — the login identifier. */
  mobile: string;
  name: string;
  email: string;
  city: string;
  createdAt: string;
  updatedAt: string;
};

const PROFILES_KEY = "mw_customer_profiles";
const SESSION_KEY = "mw_customer_session";

/**
 * Verification codes.
 *
 * No SMS provider is connected yet, so a fresh 4-digit code is generated for
 * each request and shown on screen instead of being hard-coded. There is no
 * fixed "1234" any more; the screen says delivery is not configured so nobody
 * mistakes it for a real message.
 */
export const OTP_LENGTH = 4;

let pendingOtp: string | null = null;

/** The code currently waiting to be entered (null before "Send OTP"). */
export const currentOtpCode = () => pendingOtp;

const newCode = () => {
  const digits = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(digits);
  else return String(Math.floor(1000 + Math.random() * 9000));
  return String(1000 + (digits[0]! % 9000));
};

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export type AuthSnapshot = {
  mobile: string | null;
  profile: CustomerProfile | null;
};

const SIGNED_OUT: AuthSnapshot = { mobile: null, profile: null };

type Profiles = Record<string, CustomerProfile>;

function readProfiles(): Profiles {
  const raw = replicaRead<unknown>(PROFILES_KEY, {});
  return raw && typeof raw === "object" ? (raw as Profiles) : {};
}

function writeProfiles(profiles: Profiles): boolean {
  return replicaWrite(PROFILES_KEY, profiles);
}

function readSessionMobile(): string | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null");
    return raw && typeof raw === "object" && typeof raw.mobile === "string" ? raw.mobile : null;
  } catch {
    return null;
  }
}

function writeSession(mobile: string | null): boolean {
  try {
    if (mobile === null) window.localStorage.removeItem(SESSION_KEY);
    else
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ mobile, signedInAt: new Date().toISOString() }),
      );
    return true;
  } catch {
    return false;
  }
}

function computeSnapshot(): AuthSnapshot {
  const mobile = readSessionMobile();
  if (!mobile) return SIGNED_OUT;
  const profile = readProfiles()[mobile] ?? null;
  return profile ? { mobile, profile } : SIGNED_OUT;
}

const listeners = new Set<() => void>();
let snapshot: AuthSnapshot = SIGNED_OUT;

if (typeof window !== "undefined") snapshot = computeSnapshot();

function emit() {
  snapshot = computeSnapshot();
  listeners.forEach((listener) => listener());
}

const subscribeAuth = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === SESSION_KEY || event.key === PROFILES_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const getSnapshot = () => snapshot;

/** Server + hydration snapshot: always signed out, so SSR HTML never leaks. */
const getServerSnapshot = () => SIGNED_OUT;

const noopSubscribe = () => () => {};

/**
 * Signed-in customer for the current device. `ready` is false during SSR and
 * the hydration pass, which lets the dashboard show a skeleton instead of
 * redirecting before the stored session has been read.
 */
export function useCustomerSession() {
  const state = useSyncExternalStore(subscribeAuth, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return {
    ready,
    mobile: state.mobile,
    customer: state.profile,
    signedIn: Boolean(state.mobile && state.profile),
  };
}

export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function validateMobile(
  raw: string,
): { ok: true; mobile: string } | { ok: false; error: string } {
  const mobile = normalizeMobile(raw);
  if (!mobile) return { ok: false, error: "Enter your 10-digit mobile number." };
  if (!MOBILE_RE.test(mobile)) {
    return { ok: false, error: "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9." };
  }
  return { ok: true, mobile };
}

export const maskMobile = (mobile: string) =>
  mobile.length === 10 ? `+91 ${mobile.slice(0, 2)}••••${mobile.slice(-3)}` : `+91 ${mobile}`;

export function profileFor(mobile: string): CustomerProfile | null {
  return readProfiles()[mobile] ?? null;
}

/**
 * Synchronous signed-in profile read.
 *
 * Used by action gates ("sign in before you make an offer") and by forms that
 * prefill the name and mobile of a signed-in customer.
 */
export function currentCustomer(): CustomerProfile | null {
  return computeSnapshot().profile;
}

/** Validates the number and issues a fresh code (delivery is not configured). */
export function sendOtp(raw: string): { ok: true; mobile: string } | { ok: false; error: string } {
  const result = validateMobile(raw);
  if (result.ok) pendingOtp = newCode();
  return result;
}

export function verifyOtp(code: string): { ok: true } | { ok: false; error: string } {
  const value = code.replace(/\D/g, "");
  if (value.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }
  if (!pendingOtp || value !== pendingOtp) {
    return { ok: false, error: "That code is not correct. Request a new one." };
  }
  pendingOtp = null;
  return { ok: true };
}

export function signIn(mobile: string): { ok: boolean; error?: string } {
  const validated = validateMobile(mobile);
  if (!validated.ok) return { ok: false, error: validated.error };
  if (!writeSession(validated.mobile)) {
    return {
      ok: false,
      error:
        "This browser blocked local storage, so you could not be signed in. Please allow storage and retry.",
    };
  }
  emit();
  return { ok: true };
}

/**
 * Bridge a Google (Supabase OAuth) identity into the customer profile.
 *
 * The dashboard is keyed by a local profile, so after the OAuth redirect we
 * upsert one from the verified email and start the local session. Google does
 * not supply a mobile number; the profile starts without one and the customer
 * can add it under My Profile.
 */
export function signInWithOAuthProfile(input: {
  email: string;
  name?: string | null | undefined;
}): {
  ok: boolean;
  error?: string;
  profile?: CustomerProfile;
} {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Google did not return a usable email address." };
  }

  const name =
    input.name?.trim().replace(/\s+/g, " ") ||
    email.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "Customer";
  const profiles = readProfiles();
  const existing = Object.entries(profiles).find(
    ([, profile]) => profile.email.toLowerCase() === email,
  );
  const key = existing?.[0] ?? `oauth:${email}`;
  const now = new Date().toISOString();
  const profile: CustomerProfile = {
    mobile: existing?.[1].mobile ?? "",
    name,
    email,
    city: existing?.[1].city ?? "Indore",
    createdAt: existing?.[1].createdAt ?? now,
    updatedAt: now,
  };

  profiles[key] = profile;
  if (!writeProfiles(profiles) || !writeSession(key)) {
    return {
      ok: false,
      error:
        "This browser blocked local storage, so you could not be signed in. Please allow storage and retry.",
    };
  }
  emit();
  return { ok: true, profile };
}

export function signOut() {
  writeSession(null);
  // Drop the Google session too, otherwise the login page would immediately
  // sign the same person back in from the stored Supabase session.
  void supabaseClient()?.auth.signOut();
  emit();
}

export function createAccount(input: {
  mobile: string;
  name: string;
  email: string;
  city: string;
}): { ok: true; profile: CustomerProfile } | { ok: false; error: string } {
  const mobile = validateMobile(input.mobile);
  if (!mobile.ok) return { ok: false, error: mobile.error };

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };

  const email = input.email.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const city = input.city.trim();
  if (city.length < 2) return { ok: false, error: "Please enter your city." };

  const now = new Date().toISOString();
  const profiles = readProfiles();
  const existing = profiles[mobile.mobile];
  const profile: CustomerProfile = {
    mobile: mobile.mobile,
    name,
    email,
    city,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  profiles[mobile.mobile] = profile;
  if (!writeProfiles(profiles)) {
    return {
      ok: false,
      error:
        "This browser blocked local storage, so your profile could not be saved. Please allow storage and retry.",
    };
  }
  writeSession(mobile.mobile);
  emit();
  return { ok: true, profile };
}

/** Profile edit — the mobile number is the account key, so a change re-keys it. */
export function updateProfile(input: {
  currentMobile: string;
  name: string;
  email: string;
  city: string;
  mobile: string;
}): { ok: true; profile: CustomerProfile } | { ok: false; error: string } {
  const mobile = validateMobile(input.mobile);
  if (!mobile.ok) return { ok: false, error: mobile.error };

  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };

  const email = input.email.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };

  const city = input.city.trim();
  if (city.length < 2) return { ok: false, error: "Please enter your city." };

  const profiles = readProfiles();
  const current = profiles[input.currentMobile];
  if (!current)
    return { ok: false, error: "Your account could not be found. Please sign in again." };

  if (mobile.mobile !== input.currentMobile && profiles[mobile.mobile]) {
    return {
      ok: false,
      error: "That mobile number is already linked to another account on this device.",
    };
  }

  const profile: CustomerProfile = {
    ...current,
    mobile: mobile.mobile,
    name,
    email,
    city,
    updatedAt: new Date().toISOString(),
  };

  if (mobile.mobile !== input.currentMobile) delete profiles[input.currentMobile];
  profiles[mobile.mobile] = profile;

  if (!writeProfiles(profiles)) {
    return {
      ok: false,
      error: "This browser blocked local storage, so your changes could not be saved.",
    };
  }
  if (mobile.mobile !== input.currentMobile) writeSession(mobile.mobile);
  emit();
  return { ok: true, profile };
}
