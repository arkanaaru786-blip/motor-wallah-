import { describeSupabaseError } from "@/lib/supabase";
import { staffClient, staffSession } from "@/lib/staff-auth";

/**
 * Parts and decor orders for the Master Control desk.
 *
 * Orders are written by the customer-facing API (`/api/orders`) and read here
 * through the staff Supabase session. RLS in supabase/admin-features.sql gives
 * staff read/update access; the customer's own policies are untouched.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type AdminOrderItem = { name: string; quantity: number; price: number };

export type AdminOrder = {
  id: string;
  orderRef: string;
  itemType: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  createdAt: string | null;
  customerName: string;
  mobile: string;
  city: string;
  items: AdminOrderItem[];
};

export const ORDERS_SETUP_HINT =
  "The orders desk needs supabase/admin-features.sql (staff read/update policies and the payment status column). Run it in the Supabase SQL editor, then reload.";

type OrderRow = {
  id: string;
  order_ref: string;
  item_type: string;
  status: string;
  payment_status?: string | null;
  total_amount: number | string;
  currency: string | null;
  created_at: string | null;
  delivery_name: string | null;
  delivery_mobile: string | null;
  delivery_city: string | null;
  order_items?: { name: string | null; quantity: number; price: number | string }[] | null;
};

const isMissingFeature = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) &&
  (error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    /does not exist|column .* does not exist|could not find the table|schema cache/i.test(
      error?.message ?? "",
    ));

const toOrder = (row: OrderRow): AdminOrder => ({
  id: row.id,
  orderRef: row.order_ref,
  itemType: row.item_type,
  status: row.status,
  paymentStatus: row.payment_status ?? "paid",
  totalAmount: Number(row.total_amount ?? 0),
  currency: row.currency ?? "INR",
  createdAt: row.created_at,
  customerName: row.delivery_name ?? "Customer",
  mobile: row.delivery_mobile ?? "",
  city: row.delivery_city ?? "",
  items: (row.order_items ?? []).map((item) => ({
    name: item.name ?? "Item",
    quantity: item.quantity,
    price: Number(item.price ?? 0),
  })),
});

const SELECT =
  "id, order_ref, item_type, status, payment_status, total_amount, currency, created_at, delivery_name, delivery_mobile, delivery_city, order_items(name, quantity, price)";

export async function loadAdminOrders(): Promise<{
  orders: AdminOrder[];
  missing: boolean;
  error: string | null;
}> {
  const client = staffClient();
  if (!client) return { orders: [], missing: false, error: "The database is not configured." };
  await staffSession();

  const { data, error } = await client
    .from("orders")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      orders: [],
      missing: isMissingFeature(error),
      error: isMissingFeature(error) ? ORDERS_SETUP_HINT : describeSupabaseError(error),
    };
  }
  return {
    orders: ((data ?? []) as unknown as OrderRow[]).map(toOrder),
    missing: false,
    error: null,
  };
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client.from("orders").update({ status }).eq("id", id);
  return error ? { ok: false, error: describeSupabaseError(error) } : { ok: true };
}

export const orderTotal = (order: AdminOrder) =>
  `${order.currency === "INR" ? "₹" : `${order.currency} `}${Math.round(order.totalAmount).toLocaleString("en-IN")}`;

export const orderItemSummary = (order: AdminOrder) =>
  order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "—";

export const orderStatusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);

export const orderDate = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};
