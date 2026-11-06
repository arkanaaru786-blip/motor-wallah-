/**
 * GET /api/shops/{id}/orders — every order a shop owner has to fulfil.
 *
 * The shop must belong to the caller (`shops.owner_id = auth.uid()`); anything
 * else is a 403, and the `orders read` policy would filter it out regardless.
 * Each order carries its line items and any help desk tickets raised against it,
 * which is what the shop's order-management screen needs to act on.
 *
 * Optional query string: ?status=pending&item_type=decor&limit=50
 */
import { createFileRoute } from "@tanstack/react-router";

import { databaseError, resolveCaller } from "@/lib/api/auth";
import { apiError, json, methodNotAllowed, preflight } from "@/lib/api/http";
import { ORDER_SELECT, mapOrder, parseListFilters } from "@/lib/api/orders";

export const Route = createFileRoute("/api/shops/$id/orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      GET: async ({ request, params }) => {
        const auth = await resolveCaller(request);
        if (!auth.ok) return auth.response;
        const { caller } = auth;

        const { data: shop, error: shopError } = await caller.db
          .from("shops")
          .select("id, owner_id, name")
          .eq("id", params.id)
          .maybeSingle();

        if (shopError) return databaseError(shopError);

        if (!shop) return apiError("not_found", "No shop exists with that id.");
        if (shop.owner_id !== caller.userId) {
          return apiError("forbidden", "That shop belongs to a different account.");
        }

        const filters = parseListFilters(request.url);

        let query = caller.db
          .from("orders")
          .select(ORDER_SELECT)
          .eq("shop_id", params.id)
          .order("created_at", { ascending: false })
          .limit(filters.limit);

        if (filters.status) query = query.eq("status", filters.status);
        if (filters.item_type) query = query.eq("item_type", filters.item_type);

        const { data, error } = await query;
        if (error) return databaseError(error);

        const orders = (data ?? []).map((row) =>
          mapOrder(row as unknown as Record<string, unknown>),
        );
        const openTickets = orders.reduce(
          (total, order) => total + order.tickets.filter((t) => t.status === "pending").length,
          0,
        );

        return json({
          data: orders,
          meta: {
            count: orders.length,
            limit: filters.limit,
            shop: { id: shop.id, name: shop.name },
            open_tickets: openTickets,
          },
        });
      },

      POST: () => methodNotAllowed(["GET", "OPTIONS"]),
    },
  },
});
