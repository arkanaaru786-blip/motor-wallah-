/**
 * Password hashing shared by the administrator account and the employee
 * directory. Nothing here touches storage, so both layers can verify a
 * credential without importing each other.
 *
 * Employee passwords are stored exactly like the owner's: salted
 * PBKDF2-SHA256 at 150k iterations. There is no plaintext anywhere.
 */

export const PBKDF2_ITERATIONS = 150_000;
export const MIN_PASSWORD_LENGTH = 10;

export type PasswordCredential = {
  /** base64 PBKDF2 salt */
  salt: string;
  /** base64 PBKDF2-SHA256 derived key */
  hash: string;
  iterations: number;
};

export const cryptoAvailable = () =>
  typeof window !== "undefined" && Boolean(window.crypto?.subtle);

const encoder = new TextEncoder();

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(bits);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison so a wrong password never short-circuits. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomSalt(bytes = 16): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(bytes));
}

export async function createPasswordCredential(password: string): Promise<PasswordCredential> {
  const salt = randomSalt();
  const iterations = PBKDF2_ITERATIONS;
  const hash = await pbkdf2(password, salt, iterations);
  return { salt: toBase64(salt.buffer as ArrayBuffer), hash, iterations };
}

export async function verifyPasswordCredential(
  password: string,
  credential: PasswordCredential,
): Promise<boolean> {
  const candidate = await pbkdf2(password, fromBase64(credential.salt), credential.iterations);
  return safeEqual(candidate, credential.hash);
}

/** Shared strength rule for every password the panel stores. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Include at least one letter and one number.";
  }
  if (password.trim().length !== password.length) {
    return "Remove spaces at the start or end.";
  }
  return null;
}
