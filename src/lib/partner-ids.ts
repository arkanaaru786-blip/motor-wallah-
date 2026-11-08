/**
 * Partner login identifiers and temporary passwords.
 *
 * Partners (the dealers bound to a vehicle category) and employees never sign in
 * with an email here: the administrator issues a short, human-readable ID and a
 * temporary password, then shares both privately. This module owns the shape of
 * those credentials so the admin panel, the login pages and the share message
 * cannot drift apart.
 *
 * The ID is presentation only for existing records: dealers seeded before the
 * `MW-DLR-` prefix existed keep `DLR-1001` on disk, and `dealerLoginId()` renders
 * the same `MW-DLR-1001` for them. Sign-in normalises the input, so typing
 * `MW-DLR-1001`, `DLR-1001`, `mw-dlr-1001` or the registered email all reach the
 * same account.
 *
 * Temporary passwords are generated in the browser with `crypto.getRandomValues`
 * and handed to the admin once. They are stored only as a PBKDF2 hash, so the
 * plaintext can never be shown again — a new temporary password is issued
 * instead. The alphabet skips I/O/0/1 to keep the password readable when it is
 * dictated over the phone.
 */

/** Prefixes used for every partner portal account. */
export type PartnerPortalKind = "dealer" | "workshop" | "parts" | "decor";

export const PARTNER_ID_PREFIXES: Record<PartnerPortalKind, string> = {
  dealer: "MW-DLR",
  workshop: "MW-WRK",
  parts: "MW-PRT",
  decor: "MW-DCR",
};

/** Prefix used for dealer (partner) accounts. */
export const PARTNER_ID_PREFIX = PARTNER_ID_PREFIXES.dealer;

export const partnerIdPrefix = (kind: PartnerPortalKind): string => PARTNER_ID_PREFIXES[kind];

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function randomIndex(max: number, fallbackSeed: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0]! % max;
  }
  return Math.floor(Math.random() * max + fallbackSeed) % max;
}

function randomChar(source: string, seed: number): string {
  return source[randomIndex(source.length, seed)]!;
}

/**
 * A readable temporary password, e.g. `Mw-KQ73-PMZT`.
 *
 * 13 characters, always letters *and* digits, no leading/trailing space — it
 * passes the same strength rule the control room enforces for every credential.
 */
export function generateTemporaryPassword(): string {
  const first = `${randomChar(LETTERS, 1)}${randomChar(LETTERS, 2)}`;
  const digits = `${randomChar(DIGITS, 3)}${randomChar(DIGITS, 4)}`;
  const tail = `${randomChar(LETTERS, 5)}${randomChar(LETTERS, 6)}${randomChar(
    LETTERS,
    7,
  )}${randomChar(DIGITS, 8)}`;
  return `Mw-${first}${digits}-${tail}`;
}

/** Uppercase, whitespace-free form used for comparisons. */
export function normalizeLoginId(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * The ID shown to a partner and typed at sign-in.
 *
 * Accepts a dealer/partner record or a raw id so both the admin table and the
 * portal can call it. The numeric tail is kept as-is, which is what lets a
 * workshop (MW-WRK-2001), parts shop (MW-PRT-3001) and decor studio
 * (MW-DCR-4001) each keep their own sequence.
 */
export function partnerLoginId(
  kind: PartnerPortalKind,
  partnerOrId: { id: string } | string,
): string {
  const raw = typeof partnerOrId === "string" ? partnerOrId : partnerOrId.id;
  const numeric = normalizeLoginId(raw)
    .replace(/^MW-/, "")
    .replace(/^(DLR|WRK|PRT|DCR)-?/, "");
  return `${partnerIdPrefix(kind)}-${numeric}`;
}

/** Dealer records use the MW-DLR- prefix, like every other partner account. */
export function dealerLoginId(dealerOrId: { id: string } | string): string {
  return partnerLoginId("dealer", dealerOrId);
}

/** Which portal a typed ID belongs to, or null when it is not a partner ID. */
export function partnerKindFromId(value: string): PartnerPortalKind | null {
  const id = normalizeLoginId(value);
  if (/^(MW-)?DLR-?\d+$/.test(id)) return "dealer";
  if (/^(MW-)?WRK-?\d+$/.test(id)) return "workshop";
  if (/^(MW-)?PRT-?\d+$/.test(id)) return "parts";
  if (/^(MW-)?DCR-?\d+$/.test(id)) return "decor";
  return null;
}

/** True when the typed value looks like a partner ID rather than an email. */
export function looksLikePartnerId(value: string): boolean {
  return partnerKindFromId(value) !== null;
}

/** Plain-text share message for WhatsApp/SMS — no link, no secret in the URL. */
export function credentialsMessage({
  recipient,
  id,
  password,
  portal,
  note,
}: {
  recipient: string;
  id: string;
  password: string;
  portal: string;
  /** Optional closing instruction for portals without self-service change. */
  note?: string;
}): string {
  return [
    `Hello ${recipient},`,
    "",
    "Your Motor Wallah partner account is ready.",
    `Login ID: ${id}`,
    `Temporary password: ${password}`,
    "",
    `Sign in at ${portal}`,
    note ?? "Please change this password from the login screen after your first sign-in.",
  ].join("\n");
}
