/**
 * Dealer registry.
 *
 * A dealer is a portal account bound to ONE vehicle category. The record is the
 * mock-phase home of what production keeps in Supabase (`public.staff.category`
 * plus a `dealers` profile row — see supabase/dealer-category.sql), and it syncs
 * through the same cloud store the employee directory uses, so a dealer created
 * by a super admin on one device can sign in on another.
 *
 * The password is stored exactly like an employee password: salted PBKDF2-SHA256
 * (150k iterations) in `@/lib/admin-crypto`. The plaintext is never written.
 *
 * The category is part of the account, not a preference: `signIn` refuses a
 * dealer whose category is missing, and every read in `dealer-data.ts` filters
 * on it. That is why a Cars dealer can never see a Bike listing even by editing
 * the URL.
 */
import {
  createPasswordCredential,
  cryptoAvailable,
  validatePasswordStrength,
  verifyPasswordCredential,
  type PasswordCredential,
} from "@/lib/admin-crypto";
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import {
  DEALER_CATEGORIES,
  isDealerCategory,
  type DealerCategoryId,
} from "@/lib/dealer-categories";
import { dealerLoginId, generateTemporaryPassword, normalizeLoginId } from "@/lib/partner-ids";

export type DealerStatus = "Active" | "Pending" | "Disabled";

export type Dealer = {
  /** Human-facing id, e.g. DLR-1001. */
  id: string;
  name: string;
  /** Showroom / business name shown in the portal header. */
  showroom: string;
  email: string;
  mobile: string;
  city: string;
  /** The one category this dealer may trade in. */
  category: DealerCategoryId;
  status: DealerStatus;
  createdAt: string;
  lastLoginAt: string | null;
  credential: PasswordCredential | null;
  /** True while the password is the one the admin issued and shared. */
  temporaryPassword?: boolean;
};

const KEY = "mw_dealers_v1";
const SEED_FLAG_KEY = "mw_dealers_seeded_v1";

/** Password used by the seeded demo dealers; shown on the login page. */
export const DEMO_DEALER_PASSWORD = "Dealer@2026";

const listeners = new Set<() => void>();

export function subscribeToDealers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of [...listeners]) listener();
}

function readAll(): Dealer[] {
  const raw = replicaRead<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  // Drop rows with an unknown category: an account without a valid category
  // must not fall through to "sees everything".
  return (raw as Dealer[]).filter(
    (dealer) => dealer && typeof dealer.id === "string" && isDealerCategory(dealer.category),
  );
}

function writeAll(dealers: Dealer[]): boolean {
  return replicaWrite(KEY, dealers);
}

export const listDealers = (): Dealer[] => [...readAll()].sort((a, b) => a.id.localeCompare(b.id));

export const findDealer = (id: string): Dealer | null =>
  readAll().find((dealer) => dealer.id === id) ?? null;

export function nextDealerId(dealers: Dealer[]): string {
  const highest = dealers.reduce((acc, dealer) => {
    const numeric = Number(
      normalizeLoginId(dealer.id)
        .replace(/^MW-/, "")
        .replace(/^DLR-?/, ""),
    );
    return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
  }, 1000);
  return dealerLoginId(String(highest + 1));
}

/* --------------------------------------------------------------- seeding */

const SEED_DEALERS: {
  category: DealerCategoryId;
  name: string;
  showroom: string;
  city: string;
  mobile: string;
}[] = [
  {
    category: "cars",
    name: "Imran Shaikh",
    showroom: "Skyline Cars",
    city: "Mumbai",
    mobile: "9820011201",
  },
  {
    category: "bikes",
    name: "Rahul Verma",
    showroom: "Verma Two Wheelers",
    city: "Pune",
    mobile: "9820011202",
  },
  {
    category: "three-wheelers",
    name: "Suresh Yadav",
    showroom: "Yadav Auto Rickshaw Mart",
    city: "Nagpur",
    mobile: "9820011203",
  },
  {
    category: "scv",
    name: "Farhan Qureshi",
    showroom: "Qureshi Commercial",
    city: "Hyderabad",
    mobile: "9820011204",
  },
  {
    category: "trucks",
    name: "Mahesh Patil",
    showroom: "Patil Truck Bazaar",
    city: "Nashik",
    mobile: "9820011205",
  },
  {
    category: "buses",
    name: "Anil Kumar",
    showroom: "Kumar Bus Point",
    city: "Delhi",
    mobile: "9820011206",
  },
  {
    category: "tractors",
    name: "Balaji Rao",
    showroom: "Rao Tractor House",
    city: "Bengaluru",
    mobile: "9820011207",
  },
  {
    category: "taxi",
    name: "Deepak Singh",
    showroom: "Singh Taxi Fleet",
    city: "Jaipur",
    mobile: "9820011208",
  },
];

let seeding: Promise<void> | null = null;

/**
 * Create the eight demo dealers once per browser. Each one is a working login
 * bound to a single category, which is what makes the restriction testable:
 * sign in as the Cars dealer and only Cars exists.
 */
export function ensureDealers(): Promise<void> {
  if (typeof window === "undefined" || !cryptoAvailable()) return Promise.resolve();
  if (replicaRead<boolean>(SEED_FLAG_KEY, false)) return Promise.resolve();
  if (seeding) return seeding;

  seeding = (async () => {
    const existing = readAll();
    if (existing.length === 0) {
      const created: Dealer[] = [];
      for (const seed of SEED_DEALERS) {
        const credential = await createPasswordCredential(DEMO_DEALER_PASSWORD);
        created.push({
          id: dealerLoginId(String(1001 + created.length)),
          name: seed.name,
          showroom: seed.showroom,
          email: `${seed.category}@dealer.motorwallah.in`,
          mobile: seed.mobile,
          city: seed.city,
          category: seed.category,
          status: "Active",
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
          credential,
        });
      }
      writeAll([...existing, ...created]);
      notify();
    }
    replicaWrite(SEED_FLAG_KEY, true);
    seeding = null;
  })();

  return seeding;
}

/* --------------------------------------------------------------- writing */

export type DealerInput = {
  name: string;
  showroom: string;
  email: string;
  mobile: string;
  city: string;
  category: DealerCategoryId;
  status: DealerStatus;
};

export type DealerResult =
  | {
      ok: true;
      dealer: Dealer;
      /** Set only when this call generated a temporary password to share. */
      password?: string;
    }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const normalizeMobile = (value: string) => {
  const digits = value.replace(/\D+/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

function validate(input: DealerInput, dealers: Dealer[], editingId?: string): string | null {
  if (input.name.trim().length < 2) return "Enter the dealer's full name.";
  if (input.showroom.trim().length < 2) return "Enter the showroom or business name.";
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid dealer email address.";
  if (dealers.some((dealer) => dealer.email.toLowerCase() === email && dealer.id !== editingId)) {
    return "Another dealer already uses that email.";
  }
  if (!/^[6-9]\d{9}$/.test(normalizeMobile(input.mobile))) {
    return "Enter a 10-digit Indian mobile number.";
  }
  if (!input.city.trim()) return "Enter the dealer's city.";
  if (!isDealerCategory(input.category)) return "Choose the category this dealer may sell.";
  return null;
}

export async function createDealer(
  input: DealerInput & { password?: string },
): Promise<DealerResult> {
  if (!cryptoAvailable()) {
    return { ok: false, error: "This browser cannot hash passwords, so the dealer was not saved." };
  }
  const dealers = readAll();
  const invalid = validate(input, dealers);
  if (invalid) return { ok: false, error: invalid };

  // An empty field means "issue a temporary password": the admin never has to
  // invent one, and the generated value is returned once so it can be shared.
  const issued = input.password?.trim() ? undefined : generateTemporaryPassword();
  const password = input.password?.trim() ? input.password : issued!;
  const weak = validatePasswordStrength(password);
  if (weak) return { ok: false, error: weak };

  const credential = await createPasswordCredential(password);
  const dealer: Dealer = {
    id: nextDealerId(dealers),
    name: input.name.trim().replace(/\s+/g, " "),
    showroom: input.showroom.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    city: input.city.trim(),
    category: input.category,
    status: input.status,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    credential,
    temporaryPassword: Boolean(issued),
  };
  if (!writeAll([...dealers, dealer])) {
    return { ok: false, error: "Storage is full or blocked, so the dealer was not saved." };
  }
  notify();
  return issued ? { ok: true, dealer, password: issued } : { ok: true, dealer };
}

export function setDealerStatus(id: string, status: DealerStatus): DealerResult {
  const dealers = readAll();
  const dealer = dealers.find((item) => item.id === id);
  if (!dealer) return { ok: false, error: "That dealer no longer exists." };
  const next: Dealer = { ...dealer, status };
  writeAll(dealers.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, dealer: next };
}

/** Change the category a dealer is bound to. Moves nothing; it only rebinds access. */
export function setDealerCategory(id: string, category: DealerCategoryId): DealerResult {
  if (!isDealerCategory(category)) return { ok: false, error: "Choose a valid category." };
  const dealers = readAll();
  const dealer = dealers.find((item) => item.id === id);
  if (!dealer) return { ok: false, error: "That dealer no longer exists." };
  const next: Dealer = { ...dealer, category };
  writeAll(dealers.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, dealer: next };
}

export function dealerCategoriesInUse(dealers: Dealer[]): DealerCategoryId[] {
  return DEALER_CATEGORIES.map((category) => category.id).filter((id) =>
    dealers.some((dealer) => dealer.category === id),
  );
}

/* --------------------------------------------------------------- sign in */

export type DealerSignInResult = { ok: true; dealer: Dealer } | { ok: false; error: string };

/**
 * Resolve a typed partner ID (or, for older accounts, the registered email).
 * Accepts `MW-DLR-1001`, `DLR-1001`, `mwdlr1001` and `cars@dealer.motorwallah.in`.
 */
export function findDealerByIdentity(identity: string): Dealer | null {
  const value = identity.trim();
  if (!value) return null;
  const dealers = readAll();
  const key = normalizeLoginId(value);
  const byLoginId = dealers.find((dealer) => normalizeLoginId(dealerLoginId(dealer)) === key);
  if (byLoginId) return byLoginId;
  const byId = dealers.find((dealer) => normalizeLoginId(dealer.id) === key);
  if (byId) return byId;
  if (value.includes("@")) {
    return dealers.find((dealer) => dealer.email.toLowerCase() === value.toLowerCase()) ?? null;
  }
  return null;
}

/** The partner account registered against a mobile number, for password resets. */
export function findDealerByMobile(mobile: string): Dealer | null {
  const digits = normalizeMobile(mobile);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return readAll().find((dealer) => dealer.mobile === digits) ?? null;
}

export async function verifyDealerSignIn(
  identityInput: string,
  password: string,
): Promise<DealerSignInResult> {
  await ensureDealers();
  const dealer = findDealerByIdentity(identityInput);
  const generic = "That partner ID and password do not match a dealer account." as const;
  if (!dealer || !dealer.credential) return { ok: false, error: generic };

  const valid = await verifyPasswordCredential(password, dealer.credential);
  if (!valid) return { ok: false, error: generic };

  if (dealer.status === "Disabled") {
    return {
      ok: false,
      error: "This dealer account is disabled. Ask Motor Wallah staff to re-enable it.",
    };
  }
  if (dealer.status === "Pending") {
    return {
      ok: false,
      error: "This dealer account is still awaiting approval. Ask a super admin to approve it.",
    };
  }
  if (!isDealerCategory(dealer.category)) {
    return {
      ok: false,
      error:
        "This dealer has no vehicle category assigned, so the portal cannot open. Ask an admin to set one.",
    };
  }

  const dealers = readAll();
  const next: Dealer = { ...dealer, lastLoginAt: new Date().toISOString() };
  writeAll(dealers.map((item) => (item.id === dealer.id ? next : item)));
  notify();
  return { ok: true, dealer: next };
}

/* --------------------------------------------------------- password resets */

/**
 * Self-service reset used by "Forgot password?" on the partner login page.
 * The caller verifies the mobile number with an OTP first; this only applies the
 * new credential and clears the temporary-password flag.
 */
export async function resetDealerPasswordByMobile(
  mobile: string,
  password: string,
): Promise<DealerResult> {
  if (!cryptoAvailable()) {
    return {
      ok: false,
      error: "This browser cannot hash passwords, so the password was not changed.",
    };
  }
  const dealer = findDealerByMobile(mobile);
  if (!dealer) {
    return { ok: false, error: "No partner account is registered against that mobile number." };
  }
  if (dealer.status === "Disabled") {
    return { ok: false, error: "This partner account is disabled. Ask Motor Wallah staff first." };
  }
  const weak = validatePasswordStrength(password);
  if (weak) return { ok: false, error: weak };

  const credential = await createPasswordCredential(password);
  const next: Dealer = { ...dealer, credential, temporaryPassword: false };
  if (!writeAll(readAll().map((item) => (item.id === dealer.id ? next : item)))) {
    return { ok: false, error: "Storage is full or blocked, so the password was not changed." };
  }
  notify();
  return { ok: true, dealer: next };
}

/**
 * Admin-issued temporary password (new value every call). The plaintext is
 * returned once so the admin can copy or share it; only the hash is stored.
 */
export async function rotateDealerPassword(id: string): Promise<DealerResult> {
  if (!cryptoAvailable()) {
    return { ok: false, error: "This browser cannot hash passwords, so nothing changed." };
  }
  const dealers = readAll();
  const dealer = dealers.find((item) => item.id === id);
  if (!dealer) return { ok: false, error: "That partner account no longer exists." };

  const password = generateTemporaryPassword();
  const credential = await createPasswordCredential(password);
  const next: Dealer = { ...dealer, credential, temporaryPassword: true };
  writeAll(dealers.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, dealer: next, password };
}

/** Change a partner password from the portal, after verifying the current one. */
export async function changeDealerPassword(
  id: string,
  currentPassword: string,
  password: string,
): Promise<DealerResult> {
  if (!cryptoAvailable()) {
    return {
      ok: false,
      error: "This browser cannot hash passwords, so the password was not changed.",
    };
  }
  const dealers = readAll();
  const dealer = dealers.find((item) => item.id === id);
  if (!dealer || !dealer.credential) {
    return { ok: false, error: "That partner account no longer exists." };
  }
  const valid = await verifyPasswordCredential(currentPassword, dealer.credential);
  if (!valid) return { ok: false, error: "Your current password is not correct." };

  const weak = validatePasswordStrength(password);
  if (weak) return { ok: false, error: weak };

  const credential = await createPasswordCredential(password);
  const next: Dealer = { ...dealer, credential, temporaryPassword: false };
  writeAll(dealers.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, dealer: next };
}

/** Re-exported so the portal can render the login ID without an extra import. */
export { dealerLoginId };
