/**
 * POST /api/orders — create a Parts or Decor order.
 *
 * The parts and decor apps call this after checkout. The order is written by
 * the `place_order` SQL function so the order row, its line items and the
 * server-computed total land in one transaction; a half-written order is
 * impossible.
 *
 *   Authorization: Bearer <supabase access token>
 *   {
 *     "shop_id": "uuid",
 *     "item_type": "parts" | "decor",
 *     "items": [{ "product_id": "st-9", "name": "Alloy wheel", "quantity": 2, "price": 4800 }],
 *     "delivery": { "name": "…", "mobile": "…", "city": "…", "address": "…", "pincode": "…" },
 *     "notes": "…"
 *   }
 */
import { createFileRoute } from "@tanstack/react-router";

import { databaseError, resolveCaller, zodDetails } from "@/lib/api/auth";
import { apiError, json, methodNotAllowed, preflight, readJson } from "@/lib/api/http";
import { createOrderSchema, ORDER_SELECT, mapOrder } from "@/lib/api/orders";
import { sendOrderEmails } from "@/lib/email";

export const Route = createFileRoute("/api/orders/")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      POST: async ({ request }) => {
        const auth = await resolveCaller(request);
        if (!auth.ok) return auth.response;
        const { caller } = auth;

        const body = await readJson(request);
        if (!body.ok) return body.response;

        const parsed = createOrderSchema.safeParse(body.value);
        if (!parsed.success) {
          return apiError(
            "bad_request",
            "The order payload is not valid.",
            zodDetails(parsed.error),
          );
        }

        const input = parsed.data;

        // The receipt address is carried by the request, not by the order: the
        // email column does not exist in `orders`, and `place_order` only reads
        // the delivery details it knows about.
        const { email: receiptEmail, ...deliveryFields } = input.delivery ?? {};

        // The customer id always comes from the verified token, never the body.
        const { data, error } = await caller.db.rpc("place_order", {
          p_shop_id: input.shop_id,
          p_item_type: input.item_type,
          p_items: input.items,
          p_delivery: deliveryFields,
          p_notes: input.notes ?? null,
        });

        if (error) return databaseError(error);

        const created = (Array.isArray(data) ? data[0] : data) as
          { id?: string } | null | undefined;
        if (!created?.id) {
          return apiError("server_error", "The order was not created. Try again.");
        }

        // Re-read through RLS so the response is exactly what a later GET returns.
        const { data: row, error: readError } = await caller.db
          .from("orders")
          .select(ORDER_SELECT)
          .eq("id", created.id)
          .single();

        if (readError || !row) {
          return apiError("server_error", "The order was created but could not be read back.");
        }

        const order = mapOrder(row as unknown as Record<string, unknown>);

        // Confirmation mail is sent after the order exists and is not awaited:
        // a Resend outage must never turn a paid order into an error response.
        void sendOrderEmails({
          orderRef: order.order_ref || order.id.slice(0, 8).toUpperCase(),
          itemType: order.item_type,
          total: order.total_amount,
          currency: order.currency,
          name: order.delivery.name ?? undefined,
          mobile: order.delivery.mobile ?? undefined,
          email: receiptEmail,
          city: order.delivery.city ?? undefined,
          items: order.items.map((item) => ({
            name: item.name ?? "Item",
            quantity: item.quantity,
            price: item.price,
          })),
          notes: input.notes,
        }).catch(() => undefined);

        return json({ data: order }, 201);
      },

      GET: () => methodNotAllowed(["POST", "OPTIONS"]),
    },
  },
});
