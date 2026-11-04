/**
 * Razorpay Checkout (browser side).
 *
 * Nothing secret lives here: the order is created by the server function in
 * `@/lib/payments`, which returns only the public Key ID and the order id. The
 * payment is then verified server-side before the order is treated as paid.
 */
import { replicaRead, replicaWrite } from "@/lib/cloud-store";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/payments";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const PAYMENTS_KEY = "mw_payments";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export type PaidOrder = {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
};

export type PrepaidPayment =
  | ({ status: "paid" } & PaidOrder)
  | { status: "cancelled" }
  | { status: "unavailable"; message: string };

/** Kept for the admin console and for the customer's own order history. */
function recordPayment(
  paid: PaidOrder & { description: string; customer: string; mobile: string },
) {
  try {
    const previous = replicaRead<unknown[]>(PAYMENTS_KEY, []);
    replicaWrite(
      PAYMENTS_KEY,
      [
        {
          ...paid,
          status: "Paid",
          gateway: "razorpay",
          paidAt: new Date().toISOString(),
        },
        ...previous,
      ].slice(0, 200),
    );
  } catch {
    /* the lead record below still carries the payment id */
  }
}

export type PrepaidInput = {
  /** Rupees, as displayed in the cart. Converted to paise on the server. */
  amount: number;
  receipt: string;
  description: string;
  customer: { name: string; mobile: string; city?: string };
  notes?: Record<string, string>;
};

/**
 * A thrown error here would leave the checkout form stuck on "Opening secure
 * payment…", so every failure is turned into a message the form can show.
 */
export async function payPrepaid(input: PrepaidInput): Promise<PrepaidPayment> {
  if (!Number.isFinite(input.amount) || input.amount < 1) {
    return { status: "unavailable", message: "The order total is too low for online payment." };
  }
  try {
    return await startCheckout(input);
  } catch {
    return {
      status: "unavailable",
      message: "The payment could not be started. Please try again in a moment.",
    };
  }
}

async function startCheckout(input: PrepaidInput): Promise<PrepaidPayment> {
  const order = await createRazorpayOrder({
    data: {
      amount: input.amount,
      receipt: input.receipt,
      description: input.description,
      notes: input.notes ?? {},
    },
  });

  if (!order.ok) return { status: "unavailable", message: order.message };
  if (!(await loadCheckoutScript()) || !window.Razorpay) {
    return {
      status: "unavailable",
      message:
        "Could not load the Razorpay checkout script. Check the connection, or disable any script blocker, and try again.",
    };
  }

  const Razorpay = window.Razorpay;

  return new Promise<PrepaidPayment>((resolve) => {
    let settled = false;
    const finish = (value: PrepaidPayment) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Motor Wallah",
      description: input.description,
      prefill: {
        name: input.customer.name,
        contact: input.customer.mobile,
      },
      notes: { ...input.notes },
      theme: { color: "#e11d2e" },
      // Prepaid only: UPI, cards, net banking and wallets, in that order.
      config: {
        display: {
          blocks: {
            upi: { name: "Pay with UPI", instruments: [{ method: "upi" }] },
            card: { name: "Cards", instruments: [{ method: "card" }] },
            netbanking: { name: "Net Banking", instruments: [{ method: "netbanking" }] },
            wallet: { name: "Wallets", instruments: [{ method: "wallet" }] },
          },
          sequence: ["block.upi", "block.card", "block.netbanking", "block.wallet"],
          preferences: { show_default_blocks: false },
        },
      },
      modal: {
        ondismiss: () => finish({ status: "cancelled" }),
        escape: true,
        confirm_close: true,
      },
      handler: async (response: RazorpaySuccess) => {
        const result = await verifyRazorpayPayment({
          data: {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          },
        });

        if (!result.ok || !result.verified) {
          finish({ status: "unavailable", message: result.message });
          return;
        }

        const paid: PaidOrder = {
          orderId: result.orderId,
          paymentId: result.paymentId,
          amount: order.amount / 100,
          currency: order.currency,
        };

        recordPayment({
          ...paid,
          description: input.description,
          customer: input.customer.name,
          mobile: input.customer.mobile,
        });

        finish({ status: "paid", ...paid });
      },
    });

    checkout.on("payment.failed", (response) => {
      const error = (response as { error?: { description?: string } }).error;
      finish({
        status: "unavailable",
        message: error?.description ?? "The payment failed. No money was captured.",
      });
    });

    checkout.open();
  });
}
