/**
 * Client for the Parts & Decor order API (`/api/orders`, `/api/users/{id}/orders`,
 * `POST /api/orders/{id}/report-issue`).
 *
 * The browser never touches the `orders` tables directly: rows are written and
 * read by the server routes, which take the customer id from the Supabase
 * access token instead of anything the page sends. This module only knows how
 * to attach that token and how to turn an API error into a sentence a customer
 * can read.
 */
import { startCloudSync } from "@/lib/cloud-store";
import { supabaseClient } from "@/lib/supabase";

/**
 * The shop every storefront order belongs to.
 *
 * Motor Wallah sells its own stock, so there is one marketplace shop rather
 * than a third-party seller per line. `supabase/storefront-shop.sql` creates
 * the row with this exact id; set `VITE_STOREFRONT_SHOP_ID` to point a build at
 * a different shop without touching code.
 */
export const STOREFRONT_SHOP_ID: string =
  import.meta.env["VITE_STOREFRONT_SHOP_ID"] ?? "8f4b2c1e-6a3d-4f7b-9c2e-1d5a7b9c0e3f";

export const ISSUE_TYPES = [
  { id: "wrong_item", label: "Wrong item delivered" },
  { id: "damaged_item", label: "Item arrived damaged" },
  { id: "missing_item", label: "Item missing from the parcel" },
  { id: "other", label: "Something else" },
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number]["id"];

export type OrderItem = {
  id: string;
  product_id: string;
  name: string | null;
  quantity: number;
  price: number;
};

export type OrderTicket = {
  id: string;
  issue_type: string;
  description: string;
  status: string;
  resolution_note: string | null;
  created_at: string | null;
  resolved_at: string | null;
};

export type Order = {
  id: string;
  order_ref: string;
  item_type: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string | null;
  shop: { id: string; name: string | null; city: string | null } | null;
  delivery: { name: string | null; mobile: string | null; city: string | null };
  items: OrderItem[];
  tickets: OrderTicket[];
};

export type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

export type PlacedOrder = { ok: true; order: Order } | { ok: false; message: string };

/** Why an order could not be saved, phrased for the confirmation screen. */
const FALLBACK_MESSAGE = "We could not save this order to your account. Our team has your payment.";

let signingIn: Promise<string | null> | null = null;

/**
 * The Supabase access token for this browser's visitor.
 *
 * Visitors are anonymous Supabase users (see `cloud-store`), which is enough to
 * own an order: the server only needs a verified `auth.uid()`. `startCloudSync`
 * is what signs the visitor in, so it must settle before reading the session.
 */
async function accessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const client = supabaseClient();
  if (!client) return null;

  try {
    await startCloudSync();
  } catch {
    /* fall through to the direct session check below */
  }

  const { data } = await client.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;

  // Sync may have given up (offline at load); one direct attempt is enough.
  signingIn ??= client.auth
    .signInAnonymously()
    .then(({ data: created }) => created.session?.access_token ?? null)
    .catch(() => null)
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

/** The signed-in visitor's id, used for `GET /api/users/{id}/orders`. */
export async function currentCustomerId(): Promise<string | null> {
  const client = supabaseClient();
  if (!client) return null;
  await startCloudSync().catch(() => undefined);
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

type ApiFailure = { ok: false; message: string; status: number };
type ApiSuccess<T> = { ok: true; data: T };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type ErrorBody = { error?: { code?: string; message?: string } };

/** Readable text for the API's `{ error: { code, message } }` envelope. */
async function failure(response: Response, fallback: string): Promise<ApiFailure> {
  let message = fallback;
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.error?.message) message = body.error.message;
    if (response.status === 503) {
      message = "Order history is temporarily unavailable. Please try again in a minute.";
    }
  } catch {
    /* keep the fallback sentence */
  }
  return { ok: false, message, status: response.status };
}

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = await accessToken();
  if (!token) {
    return {
      ok: false,
      message: "We could not verify this browser. Reload the page and try again.",
      status: 401,
    };
  }

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) return failure(response, "The request could not be completed.");
    const body = (await response.json()) as { data: T };
    return { ok: true, data: body.data };
  } catch {
    return {
      ok: false,
      message: "Network problem — check your connection and try again.",
      status: 0,
    };
  }
}

/**
 * Record a paid checkout as an order.
 *
 * Called after the Razorpay payment is verified: the gateway has the money, so
 * a failure here must not stop the confirmation screen — it returns a message
 * for the customer to quote instead.
 */
export async function placeOrder(input: {
  itemType: "parts" | "decor";
  lines: OrderLine[];
  delivery: {
    name?: string | undefined;
    mobile?: string | undefined;
    city?: string | undefined;
    /** Optional receipt address — the order confirmation email is sent here. */
    email?: string | undefined;
  };
  notes?: string | undefined;
}): Promise<PlacedOrder> {
  const result = await call<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      shop_id: STOREFRONT_SHOP_ID,
      item_type: input.itemType,
      items: input.lines.map((line) => ({
        product_id: line.productId,
        name: line.name,
        quantity: line.quantity,
        price: line.price,
      })),
      delivery: {
        ...(input.delivery.name ? { name: input.delivery.name } : {}),
        ...(input.delivery.mobile ? { mobile: input.delivery.mobile } : {}),
        ...(input.delivery.city ? { city: input.delivery.city } : {}),
        ...(input.delivery.email ? { email: input.delivery.email } : {}),
      },
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.status === 400 && /shop/i.test(result.message)
          ? "The storefront shop is not set up yet, so this order could not be saved."
          : result.message || FALLBACK_MESSAGE,
    };
  }
  return { ok: true, order: result.data };
}

/** This visitor's order history, newest first. */
export async function listMyOrders(): Promise<ApiResult<Order[]>> {
  const customerId = await currentCustomerId();
  if (!customerId) {
    return {
      ok: false,
      message: "Sign in on this browser to see your orders.",
      status: 401,
    };
  }
  return call<Order[]>(`/api/users/${customerId}/orders?limit=50`);
}

/** What `POST /api/orders/{id}/report-issue` returns: the created ticket. */
export type CreatedTicket = {
  id: string;
  order_id: string;
  issue_type: string;
  description: string;
  status: string;
  created_at: string | null;
};

export type ReportIssueResult =
  { ok: true; ticket: CreatedTicket } | { ok: false; message: string };

/** File a wrong / damaged / missing item ticket against one of your orders. */
export async function reportOrderIssue(input: {
  orderId: string;
  issueType: IssueType;
  description: string;
}): Promise<ReportIssueResult> {
  const result = await call<CreatedTicket>(`/api/orders/${input.orderId}/report-issue`, {
    method: "POST",
    body: JSON.stringify({ issue_type: input.issueType, description: input.description }),
  });

  if (result.ok) return { ok: true, ticket: result.data };

  // 409 = an open ticket of this type already exists; that is a normal outcome.
  return {
    ok: false,
    message:
      result.status === 409
        ? "You already have an open report for this order. Our team will reply on it."
        : result.message,
  };
}

/** `MW-ORD-48219` style refs are enough on screen; the uuid is for links. */
export const orderRefLabel = (order: Order) =>
  order.order_ref || order.id.slice(0, 8).toUpperCase();

export const rupeesFrom = (amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

export const orderDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const statusTone = (status: string): "pending" | "progress" | "done" => {
  if (status === "delivered") return "done";
  if (status === "pending" || status === "cancelled") return "pending";
  return "progress";
};

export const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

export const issueLabel = (issueType: string) =>
  ISSUE_TYPES.find((type) => type.id === issueType)?.label ?? "Issue";
