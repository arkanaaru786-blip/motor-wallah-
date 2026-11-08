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

/** Prefix used for dealer (partner) accounts. */
export const PARTNER_ID_PREFIX = "MW-DLR";

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
 * Accepts a dealer record or a raw id so both the admin table and the portal can
 * call it.
 */
export function dealerLoginId(dealerOrId: { id: string } | string): string {
  const raw = typeof dealerOrId === "string" ? dealerOrId : dealerOrId.id;
  const numeric = normalizeLoginId(raw)
    .replace(/^MW-/, "")
    .replace(/^DLR-?/, "");
  return `${PARTNER_ID_PREFIX}-${numeric}`;
}

/** True when the typed value looks like a partner ID rather than an email. */
export function looksLikePartnerId(value: string): boolean {
  return /^(MW-)?DLR-?\d+$/i.test(value.trim());
}

/** Plain-text share message for WhatsApp/SMS — no link, no secret in the URL. */
export function credentialsMessage({
  recipient,
  id,
  password,
  portal,
}: {
  recipient: string;
  id: string;
  password: string;
  portal: string;
}): string {
  return [
    `Hello ${recipient},`,
    "",
    "Your Motor Wallah partner account is ready.",
    `Login ID: ${id}`,
    `Temporary password: ${password}`,
    "",
    `Sign in at ${portal}`,
    "Please change this password from the login screen after your first sign-in.",
  ].join("\n");
}
