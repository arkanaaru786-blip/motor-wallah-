/**
 * Order + help desk shapes shared by the four `/api/*` routes.
 *
 * Prices and totals are never trusted from the client: the `place_order`
 * function in `supabase/orders-helpdesk.sql` recomputes the total from the line
 * items inside a single database transaction, and this schema only forwards the
 * item list.
 */
import { z } from "zod";

export const itemTypes = ["parts", "decor"] as const;
export const orderStatuses = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export const issueTypes = ["wrong_item", "damaged_item", "missing_item", "other"] as const;

const lineItem = z.object({
  product_id: z.string().trim().min(1).max(120),
  name: z.string().trim().max(200).optional(),
  quantity: z.number().int().min(1).max(999),
  /** Unit price in rupees, set by the app's catalogue. */
  price: z.number().finite().min(0).max(10_000_000),
});

const delivery = z
  .object({
    name: z.string().trim().max(120).optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^[0-9+ ]{10,15}$/, "Enter a 10-digit mobile number")
      .optional(),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(400).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, "Enter a 6-digit pincode")
      .optional(),
  })
  .optional();

export const createOrderSchema = z.object({
  shop_id: z.string().uuid("shop_id must be a shop UUID"),
  item_type: z.enum(itemTypes),
  items: z.array(lineItem).min(1, "Send at least one line item").max(100),
  delivery: delivery,
  notes: z.string().trim().max(1000).optional(),
});

export const reportIssueSchema = z.object({
  issue_type: z.enum(issueTypes),
  description: z.string().trim().min(10, "Describe the problem in 10 characters or more").max(2000),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;

/**
 * Embedded items, tickets and the shop in one round trip. PostgREST resolves
 * the relationships from the foreign keys, and RLS still applies to each
 * embedded table, so a customer never sees another customer's rows.
 */
export const ORDER_SELECT =
  "id, order_ref, customer_id, shop_id, item_type, status, total_amount, currency, " +
  "delivery_name, delivery_mobile, delivery_city, delivery_address, delivery_pincode, " +
  "notes, created_at, updated_at, " +
  "shops ( id, name, kind, city, phone ), " +
  "order_items ( id, product_id, name, quantity, price ), " +
  "help_desk_tickets ( id, issue_type, description, status, resolution_note, created_at, resolved_at )";

type Row = Record<string, unknown>;

const number = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

/** Public order shape: camel-free, stable keys, nested items and tickets. */
export type OrderResponse = {
  id: string;
  order_ref: string;
  customer_id: string;
  shop_id: string;
  shop: {
    id: string;
    name: string | null;
    kind: string | null;
    city: string | null;
    phone: string | null;
  } | null;
  item_type: string;
  status: string;
  total_amount: number;
  currency: string;
  delivery: {
    name: string | null;
    mobile: string | null;
    city: string | null;
    address: string | null;
    pincode: string | null;
  };
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  items: {
    id: string;
    product_id: string;
    name: string | null;
    quantity: number;
    price: number;
  }[];
  tickets: {
    id: string;
    issue_type: string;
    description: string;
    status: string;
    resolution_note: string | null;
    created_at: string | null;
    resolved_at: string | null;
  }[];
};

export function mapOrder(row: Row): OrderResponse {
  const shop = (row["shops"] ?? null) as Row | null;
  const items = Array.isArray(row["order_items"]) ? (row["order_items"] as Row[]) : [];
  const tickets = Array.isArray(row["help_desk_tickets"])
    ? (row["help_desk_tickets"] as Row[])
    : [];

  return {
    id: String(row["id"]),
    order_ref: String(row["order_ref"] ?? ""),
    customer_id: String(row["customer_id"] ?? ""),
    shop_id: String(row["shop_id"] ?? ""),
    shop: shop
      ? {
          id: String(shop["id"]),
          name: text(shop["name"]),
          kind: text(shop["kind"]),
          city: text(shop["city"]),
          phone: text(shop["phone"]),
        }
      : null,
    item_type: String(row["item_type"] ?? ""),
    status: String(row["status"] ?? ""),
    total_amount: number(row["total_amount"]),
    currency: String(row["currency"] ?? "INR"),
    delivery: {
      name: text(row["delivery_name"]),
      mobile: text(row["delivery_mobile"]),
      city: text(row["delivery_city"]),
      address: text(row["delivery_address"]),
      pincode: text(row["delivery_pincode"]),
    },
    notes: text(row["notes"]),
    created_at: text(row["created_at"]),
    updated_at: text(row["updated_at"]),
    items: items.map((item) => ({
      id: String(item["id"]),
      product_id: String(item["product_id"] ?? ""),
      name: text(item["name"]),
      quantity: number(item["quantity"]),
      price: number(item["price"]),
    })),
    tickets: tickets.map((ticket) => ({
      id: String(ticket["id"]),
      issue_type: String(ticket["issue_type"] ?? ""),
      description: String(ticket["description"] ?? ""),
      status: String(ticket["status"] ?? ""),
      resolution_note: text(ticket["resolution_note"]),
      created_at: text(ticket["created_at"]),
      resolved_at: text(ticket["resolved_at"]),
    })),
  };
}

/** Query string filters shared by both order lists. */
export type ListFilters = {
  status?: string;
  item_type?: string;
  limit: number;
};

export function parseListFilters(url: string): ListFilters {
  const params = new URL(url).searchParams;
  const status = params.get("status")?.trim().toLowerCase() ?? "";
  const itemType = params.get("item_type")?.trim().toLowerCase() ?? "";
  const rawLimit = Number(params.get("limit") ?? 50);

  return {
    ...(orderStatuses.includes(status as (typeof orderStatuses)[number]) ? { status } : {}),
    ...(itemTypes.includes(itemType as (typeof itemTypes)[number]) ? { item_type: itemType } : {}),
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50,
  };
}
