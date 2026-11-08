/**
 * Partner registry — Workshop, Auto Parts and Decor portal accounts.
 *
 * These accounts are siblings of the dealer registry (`@/lib/dealers`), not a
 * replacement for it: a dealer keeps the email login the existing portal uses,
 * while a workshop / parts / decor partner signs in with the ID + password
 * issued here (e.g. MW-WRK-2001). Passwords use the same salted PBKDF2-SHA256
 * hashes as every other credential in the product (`@/lib/admin-crypto`), so
 * no plaintext is ever stored.
 *
 * The type is part of the account, exactly like a dealer's category: an ID is
 * only valid on its own portal, and every portal read filters on `partnerId`.
 * A workshop ID cannot open the parts portal even if it is typed there.
 */
import {
  createPasswordCredential,
  cryptoAvailable,
  validatePasswordStrength,
  verifyPasswordCredential,
  type PasswordCredential,
} from "@/lib/admin-crypto";
import { replicaRead, replicaWrite } from "@/lib/cloud-store";

export type PartnerType = "workshop" | "parts" | "decor";
export type PartnerStatus = "Active" | "Pending" | "Disabled";

type PartnerPortalPath = "/workshop" | "/parts" | "/decor-partner";
type PartnerLoginPath = "/workshop-login" | "/parts-login" | "/decor-login";

export type PartnerTypeDef = {
  id: PartnerType;
  /** Singular label, e.g. "Workshop". */
  label: string;
  /** Plural label used in admin headings. */
  plural: string;
  /** ID prefix the admin panel auto-generates. */
  prefix: string;
  /** First number issued for this type. */
  startAt: number;
  portalPath: PartnerPortalPath;
  loginPath: PartnerLoginPath;
  idPlaceholder: string;
  blurb: string;
};

export const PARTNER_TYPES: PartnerTypeDef[] = [
  {
    id: "workshop",
    label: "Workshop",
    plural: "Workshops",
    prefix: "MW-WRK",
    startAt: 2001,
    portalPath: "/workshop",
    loginPath: "/workshop-login",
    idPlaceholder: "MW-WRK-2001",
    blurb: "Job cards, mechanic notes, parts used and delivery status.",
  },
  {
    id: "parts",
    label: "Auto Parts",
    plural: "Auto Parts shops",
    prefix: "MW-PRT",
    startAt: 3001,
    portalPath: "/parts",
    loginPath: "/parts-login",
    idPlaceholder: "MW-PRT-3001",
    blurb: "Order fulfilment, invoices and stock for auto parts.",
  },
  {
    id: "decor",
    label: "Decor",
    plural: "Decor studios",
    prefix: "MW-DCR",
    startAt: 4001,
    portalPath: "/decor-partner",
    loginPath: "/decor-login",
    idPlaceholder: "MW-DCR-4001",
    blurb: "Order fulfilment and stock for vehicle decor items.",
  },
];

export const isPartnerType = (value: unknown): value is PartnerType =>
  value === "workshop" || value === "parts" || value === "decor";

export const getPartnerType = (id: PartnerType): PartnerTypeDef => {
  const def = PARTNER_TYPES.find((type) => type.id === id);
  if (!def) throw new Error(`Unknown partner type: ${id}`);
  return def;
};

export type Partner = {
  /** Human-facing id, e.g. MW-WRK-2001. */
  id: string;
  type: PartnerType;
  /** Contact person. */
  name: string;
  /** Business name shown in the portal header. */
  business: string;
  email: string;
  mobile: string;
  city: string;
  status: PartnerStatus;
  createdAt: string;
  lastLoginAt: string | null;
  credential: PasswordCredential | null;
};

const KEY = "mw_partners_v1";
const SEED_FLAG_KEY = "mw_partners_seeded_v1";

/** Password used by the seeded demo partners; shown on each login page. */
export const DEMO_PARTNER_PASSWORD = "Partner@2026";

const listeners = new Set<() => void>();

export function subscribeToPartners(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of [...listeners]) listener();
}

function readAll(): Partner[] {
  const raw = replicaRead<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  // Rows without a known type are dropped rather than falling through to any
  // portal: an account must always belong to exactly one partner type.
  return (raw as Partner[]).filter(
    (partner) =>
      partner &&
      typeof partner.id === "string" &&
      isPartnerType(partner.type) &&
      partner.id.startsWith(`${getPartnerType(partner.type).prefix}-`),
  );
}

function writeAll(partners: Partner[]): boolean {
  return replicaWrite(KEY, partners);
}

export const listPartners = (): Partner[] =>
  [...readAll()].sort((a, b) => a.id.localeCompare(b.id));

export const listPartnersOfType = (type: PartnerType): Partner[] =>
  listPartners().filter((partner) => partner.type === type);

export const findPartner = (id: string): Partner | null =>
  readAll().find((partner) => partner.id === normalizePartnerId(id)) ?? null;

export const normalizePartnerId = (value: string): string => value.trim().toUpperCase();

/** Next auto-generated id for a type: MW-WRK-2001, MW-WRK-2002, … */
export function nextPartnerId(type: PartnerType, partners: Partner[]): string {
  const def = getPartnerType(type);
  const prefix = `${def.prefix}-`;
  const highest = partners.reduce((acc, partner) => {
    if (partner.type !== type || !partner.id.startsWith(prefix)) return acc;
    const numeric = Number(partner.id.slice(prefix.length));
    return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
  }, def.startAt - 1);
  return `${def.prefix}-${highest + 1}`;
}

/* --------------------------------------------------------------- seeding */

const SEED_PARTNERS: Record<
  PartnerType,
  { name: string; business: string; email: string; mobile: string; city: string }
> = {
  workshop: {
    name: "Rakesh Gaikwad",
    business: "Motor Wallah Service Hub",
    email: "workshop@partner.motorwallah.in",
    mobile: "9820012001",
    city: "Pune",
  },
  parts: {
    name: "Nitin Shah",
    business: "Genuine Auto Spares",
    email: "parts@partner.motorwallah.in",
    mobile: "9820013001",
    city: "Mumbai",
  },
  decor: {
    name: "Priya Nair",
    business: "StyleMyRide Decor Studio",
    email: "decor@partner.motorwallah.in",
    mobile: "9820014001",
    city: "Bengaluru",
  },
};

function readSeedFlags(): Record<string, boolean> {
  const raw = replicaRead<unknown>(SEED_FLAG_KEY, {});
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, boolean>;
}

let seeding: Promise<void> | null = null;

/**
 * Create one working demo login per partner type, once per browser. Accounts
 * created by the admin panel are never touched; a type that already has any
 * account is left alone.
 */
export function ensurePartners(): Promise<void> {
  if (typeof window === "undefined" || !cryptoAvailable()) return Promise.resolve();
  if (seeding) return seeding;

  seeding = (async () => {
    const partners = readAll();
    const flags = readSeedFlags();
    const created: Partner[] = [];

    for (const def of PARTNER_TYPES) {
      if (flags[def.id]) continue;
      if (partners.some((partner) => partner.type === def.id)) {
        flags[def.id] = true;
        continue;
      }
      const seed = SEED_PARTNERS[def.id];
      const credential = await createPasswordCredential(DEMO_PARTNER_PASSWORD);
      created.push({
        id: `${def.prefix}-${def.startAt}`,
        type: def.id,
        name: seed.name,
        business: seed.business,
        email: seed.email,
        mobile: seed.mobile,
        city: seed.city,
        status: "Active",
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        credential,
      });
      flags[def.id] = true;
    }

    if (created.length > 0) {
      writeAll([...partners, ...created]);
      notify();
    }
    replicaWrite(SEED_FLAG_KEY, flags);
  })().finally(() => {
    seeding = null;
  });

  return seeding;
}

/* --------------------------------------------------------------- writing */

export type PartnerInput = {
  type: PartnerType;
  name: string;
  business: string;
  email: string;
  mobile: string;
  city: string;
  status: PartnerStatus;
};

export type PartnerResult = { ok: true; partner: Partner } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const normalizeMobile = (value: string) => {
  const digits = value.replace(/\D+/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

function validate(input: PartnerInput, partners: Partner[], editingId?: string): string | null {
  if (!isPartnerType(input.type)) return "Choose the partner type.";
  if (input.name.trim().length < 2) return "Enter the partner contact name.";
  if (input.business.trim().length < 2) return "Enter the business name.";
  if (!/^[6-9]\d{9}$/.test(normalizeMobile(input.mobile))) {
    return "Enter a 10-digit Indian mobile number.";
  }
  if (!input.city.trim()) return "Enter the partner's city.";
  const email = input.email.trim().toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) return "Enter a valid email address, or leave it blank.";
  if (
    email &&
    partners.some((partner) => partner.email.toLowerCase() === email && partner.id !== editingId)
  ) {
    return "Another partner already uses that email.";
  }
  return null;
}

export async function createPartner(
  input: PartnerInput & { password: string },
): Promise<PartnerResult> {
  if (!cryptoAvailable()) {
    return {
      ok: false,
      error: "This browser cannot hash passwords, so the partner was not saved.",
    };
  }
  const partners = readAll();
  const invalid = validate(input, partners);
  if (invalid) return { ok: false, error: invalid };
  const weak = validatePasswordStrength(input.password);
  if (weak) return { ok: false, error: weak };

  const credential = await createPasswordCredential(input.password);
  const partner: Partner = {
    id: nextPartnerId(input.type, partners),
    type: input.type,
    name: input.name.trim().replace(/\s+/g, " "),
    business: input.business.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    mobile: normalizeMobile(input.mobile),
    city: input.city.trim(),
    status: input.status,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    credential,
  };
  if (!writeAll([...partners, partner])) {
    return { ok: false, error: "Storage is full or blocked, so the partner was not saved." };
  }
  notify();
  return { ok: true, partner };
}

export function setPartnerStatus(id: string, status: PartnerStatus): PartnerResult {
  const partners = readAll();
  const partner = partners.find((item) => item.id === id);
  if (!partner) return { ok: false, error: "That partner no longer exists." };
  const next: Partner = { ...partner, status };
  writeAll(partners.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, partner: next };
}

/** Admin reset: replaces the hash; the plaintext is only returned to the caller. */
export async function setPartnerPassword(id: string, password: string): Promise<PartnerResult> {
  if (!cryptoAvailable()) {
    return { ok: false, error: "This browser cannot hash passwords." };
  }
  const weak = validatePasswordStrength(password);
  if (weak) return { ok: false, error: weak };
  const partners = readAll();
  const partner = partners.find((item) => item.id === id);
  if (!partner) return { ok: false, error: "That partner no longer exists." };
  const credential = await createPasswordCredential(password);
  const next: Partner = { ...partner, credential };
  writeAll(partners.map((item) => (item.id === id ? next : item)));
  notify();
  return { ok: true, partner: next };
}

/* --------------------------------------------------------------- sign in */

export type PartnerSignInResult = { ok: true; partner: Partner } | { ok: false; error: string };

export async function verifyPartnerSignIn(
  type: PartnerType,
  idInput: string,
  password: string,
): Promise<PartnerSignInResult> {
  await ensurePartners();
  const def = getPartnerType(type);
  const id = normalizePartnerId(idInput);
  const partners = readAll();
  const partner = partners.find((item) => item.id === id && item.type === type);
  const generic = `That ID and password do not match a ${def.label.toLowerCase()} partner account.`;
  if (!partner || !partner.credential) return { ok: false, error: generic };

  const valid = await verifyPasswordCredential(password, partner.credential);
  if (!valid) return { ok: false, error: generic };

  if (partner.status === "Disabled") {
    return {
      ok: false,
      error: `${def.label} access for this account is disabled. Ask Motor Wallah staff to re-enable it.`,
    };
  }
  if (partner.status === "Pending") {
    return {
      ok: false,
      error: "This partner account is still awaiting approval. Ask an admin to approve it.",
    };
  }

  const next: Partner = { ...partner, lastLoginAt: new Date().toISOString() };
  writeAll(partners.map((item) => (item.id === partner.id ? next : item)));
  notify();
  return { ok: true, partner: next };
}

/* ----------------------------------------------------------- credentials */

export function partnerWhatsAppLink(mobile: string, message: string): string {
  const digits = mobile.replace(/\D+/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Credential message an admin can send to a partner on WhatsApp. */
export function partnerCredentialMessage(
  partner: { id: string; type: PartnerType; business: string },
  password: string,
): string {
  const def = getPartnerType(partner.type);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return [
    `Hi ${partner.business},`,
    "",
    `Your Motor Wallah ${def.label} Portal login is ready.`,
    `Portal ID: ${partner.id}`,
    `Password: ${password}`,
    `Sign in: ${origin}${def.loginPath}`,
    "",
    "Keep this password private. Ask Motor Wallah staff if you need it reset.",
  ].join("\n");
}
