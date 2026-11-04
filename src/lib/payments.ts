/**
 * Razorpay payment endpoints (server only).
 *
 * These are TanStack Start server functions: the browser calls them like a
 * normal async function, but `handler` bodies are stripped from the client
 * bundle and executed on the server, which is how the Key Secret stays private.
 *
 *   createRazorpayOrder  -> POST equivalent of /api/create-order
 *   verifyRazorpayPayment-> POST equivalent of /api/verify-payment
 *
 * Razorpay's REST API is called with `fetch` + HTTP Basic auth instead of their
 * node SDK: the SDK is CommonJS and drags Node networking into the bundle,
 * while a single orders call needs no more than this.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isValidRazorpaySignature } from "@/lib/payment-signature";

/**
 * Real gateway unless RAZORPAY_API_BASE points somewhere else, which is only
 * used to exercise the checkout against a local stub during development.
 */
function ordersUrl(): string {
  const base =
    (typeof process !== "undefined" && process.env["RAZORPAY_API_BASE"]) ||
    "https://api.razorpay.com";
  return `${base.replace(/\/+$/, "")}/v1/orders`;
}

/**
 * Dev servers and plain Node processes do not read `.env.local` into
 * `process.env` the way Vite does for `import.meta.env`, so load it lazily on
 * the server. The secret is only ever read here — never through a VITE_ name,
 * which would compile it into the browser bundle.
 */
function loadLocalEnv(): void {
  if (typeof process === "undefined" || typeof process.loadEnvFile !== "function") return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* file absent — the deployment supplies real environment variables */
    }
  }
}

type Env = { keyId: string; keySecret: string };

/** A placeholder left in the file must never be sent to Razorpay as a secret. */
function isPlaceholderSecret(secret: string): boolean {
  return secret === "" || /^YOUR_SECRET|^your_secret|_HERE$/i.test(secret);
}

function readProcessEnv(): Env {
  const env = typeof process !== "undefined" ? process.env : {};
  const keyId = env["VITE_RAZORPAY_KEY_ID"] ?? env["RAZORPAY_KEY_ID"] ?? "";
  const keySecret = env["RAZORPAY_KEY_SECRET"] ?? "";
  return { keyId: keyId.trim(), keySecret: keySecret.trim() };
}

/**
 * Real environment variables always win. `.env.local` is only read when the
 * process has no usable values, so a deployment's injected secret is never
 * replaced by a developer's local placeholder.
 */
function readEnv(): Env {
  const current = readProcessEnv();
  if (current.keyId && !isPlaceholderSecret(current.keySecret)) return current;
  loadLocalEnv();
  const loaded = readProcessEnv();
  return {
    keyId: current.keyId || loaded.keyId,
    keySecret: !isPlaceholderSecret(current.keySecret) ? current.keySecret : loaded.keySecret,
  };
}

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      /** Charge amount in paise, exactly as Razorpay holds it. */
      amount: number;
      currency: string;
      keyId: string;
    }
  | { ok: false; code: "not_configured" | "gateway_error"; message: string };

export type VerifyPaymentResult =
  | { ok: true; verified: true; orderId: string; paymentId: string }
  | { ok: true; verified: false; orderId: string; paymentId: string; message: string }
  | { ok: false; code: "not_configured" | "bad_request"; message: string };

const createOrderInput = z.object({
  /** Order total in rupees; converted to paise here so the client cannot mis-scale it. */
  amount: z.number().finite().min(1).max(500000),
  /** Our own order reference, shown in the Razorpay dashboard. */
  receipt: z.string().min(3).max(40),
  description: z.string().max(200).optional(),
  notes: z.record(z.string().max(500)).optional(),
});

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => createOrderInput.parse(input))
  .handler(async ({ data }): Promise<CreateOrderResult> => {
    const { keyId, keySecret } = readEnv();

    if (!keyId || isPlaceholderSecret(keySecret)) {
      return {
        ok: false,
        code: "not_configured",
        message:
          "Online payment is not switched on yet. Add RAZORPAY_KEY_SECRET to the server environment, then reload.",
      };
    }

    const amountPaise = Math.round(data.amount * 100);
    const auth = btoa(`${keyId}:${keySecret}`);

    try {
      const response = await fetch(ordersUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: data.receipt,
          payment_capture: 1,
          notes: { ...data.notes, description: data.description ?? "" },
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        id?: string;
        amount?: number;
        currency?: string;
        error?: { description?: string };
      } | null;

      if (!response.ok || !body?.id) {
        // The gateway's message is safe to surface; credentials are never echoed.
        return {
          ok: false,
          code: "gateway_error",
          message:
            body?.error?.description ??
            `Razorpay rejected the order request (HTTP ${response.status}).`,
        };
      }

      return {
        ok: true,
        orderId: body.id,
        amount: body.amount ?? amountPaise,
        currency: body.currency ?? "INR",
        keyId,
      };
    } catch {
      return {
        ok: false,
        code: "gateway_error",
        message: "Could not reach Razorpay. Check the connection and try again.",
      };
    }
  });

const verifyInput = z.object({
  orderId: z.string().min(4).max(120),
  paymentId: z.string().min(4).max(120),
  signature: z.string().min(8).max(256),
});

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .validator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data }): Promise<VerifyPaymentResult> => {
    const { keySecret } = readEnv();

    if (isPlaceholderSecret(keySecret)) {
      return {
        ok: false,
        code: "not_configured",
        message: "Payment verification is not configured on the server.",
      };
    }

    const verified = await isValidRazorpaySignature({
      orderId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
      secret: keySecret,
    });

    if (!verified) {
      return {
        ok: true,
        verified: false,
        orderId: data.orderId,
        paymentId: data.paymentId,
        message: "This payment could not be verified, so the order was not marked paid.",
      };
    }

    return { ok: true, verified: true, orderId: data.orderId, paymentId: data.paymentId };
  });
