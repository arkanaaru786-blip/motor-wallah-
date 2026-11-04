/**
 * Razorpay signature verification.
 *
 * A payment is only trustworthy when the HMAC-SHA256 of
 * `order_id|payment_id`, keyed with the account's Key Secret, matches the
 * `razorpay_signature` the checkout returned. The secret never leaves the
 * server, so this module is imported by server handlers only.
 *
 * Web Crypto is used rather than `node:crypto` because the same code runs on
 * the Node dev server and on the edge runtime the production build targets.
 */

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(payload: string, secret: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable in this runtime");
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(signature);
}

/** Constant-time-ish comparison: length first, then every character. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type SignatureCheck = {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
};

export async function isValidRazorpaySignature({
  orderId,
  paymentId,
  signature,
  secret,
}: SignatureCheck): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = await hmacSha256Hex(`${orderId}|${paymentId}`, secret);
  return safeEqual(expected, signature.trim().toLowerCase());
}
