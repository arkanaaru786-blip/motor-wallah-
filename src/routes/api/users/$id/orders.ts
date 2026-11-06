/**
 * GET /api/users/{id}/orders — a customer's own order history.
 *
 * `{id}` must be the caller's own Supabase user id: the token is the only
 * authority here, so asking for somebody else's history is a 403. Even if that
 * check were removed, the `orders read` policy would return no rows for another
 * customer, which is the second line of defence.
 *
 * Optional query string: ?status=pending&item_type=parts&limit=50
 */
import { createFileRoute } from "@tanstack/react-router";

import { databaseError, resolveCaller } from "@/lib/api/auth";
import { apiError, json, methodNotAllowed, preflight } from "@/lib/api/http";
import { ORDER_SELECT, mapOrder, parseListFilters } from "@/lib/api/orders";

export const Route = createFileRoute("/api/users/$id/orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      GET: async ({ request, params }) => {
        const auth = await resolveCaller(request);
        if (!auth.ok) return auth.response;
        const { caller } = auth;

        if (params.id !== caller.userId) {
          return apiError("forbidden", "You can only read your own order history.");
        }

        const filters = parseListFilters(request.url);

        let query = caller.db
          .from("orders")
          .select(ORDER_SELECT)
          .eq("customer_id", caller.userId)
          .order("created_at", { ascending: false })
          .limit(filters.limit);

        if (filters.status) query = query.eq("status", filters.status);
        if (filters.item_type) query = query.eq("item_type", filters.item_type);

        const { data, error } = await query;
        if (error) return databaseError(error);

        const orders = (data ?? []).map((row) =>
          mapOrder(row as unknown as Record<string, unknown>),
        );
        return json({
          data: orders,
          meta: { count: orders.length, limit: filters.limit },
        });
      },

      POST: () => methodNotAllowed(["GET", "OPTIONS"]),
    },
  },
});
