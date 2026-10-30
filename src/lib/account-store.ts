import { useSyncExternalStore } from "react";

/**
 * Customer accounts (device-local, mock OTP).
 *
 * This project has no authentication backend yet. Login is a real, working
 * flow on the device: a mobile number is verified against a fixed demo OTP,
 * a customer profile is created or restored, and the signed-in session is
 * remembered in localStorage. Nothing here contacts a server, so the UI says
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

/** Demo verification code. Shown in the UI because no SMS is sent. */
export const MOCK_OTP = "1234";
export const OTP_LENGTH = 4;

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export type AuthSnapshot = {
  mobile: string | null;
  profile: CustomerProfile | null;
};

const SIGNED_OUT: AuthSnapshot = { mobile: null, profile: null };

type Profiles = Record<string, CustomerProfile>;

function readProfiles(): Profiles {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(PROFILES_KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Profiles) : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles: Profiles): boolean {
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

function readSessionMobile(): string | null {
  if (typeof window === "undefined") return null;
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

/** Mock OTP "send": validates the number and returns it normalised. */
export function sendOtp(raw: string): { ok: true; mobile: string } | { ok: false; error: string } {
  return validateMobile(raw);
}

export function verifyOtp(code: string): { ok: true } | { ok: false; error: string } {
  const value = code.replace(/\D/g, "");
  if (value.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code.` };
  }
  if (value !== MOCK_OTP) {
    return { ok: false, error: `That code does not match. This demo uses ${MOCK_OTP}.` };
  }
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

export function signOut() {
  writeSession(null);
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
