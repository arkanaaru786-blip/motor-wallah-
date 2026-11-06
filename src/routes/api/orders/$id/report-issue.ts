/**
 * POST /api/orders/{id}/report-issue — help desk for wrong or damaged orders.
 *
 * Creates a support ticket against one of the caller's own orders. Ownership,
 * issue type and description length are all enforced inside
 * `report_order_issue` in SQL as well, so a direct call to the database with the
 * publishable key cannot file a ticket on somebody else's order.
 *
 *   { "issue_type": "wrong_item" | "damaged_item" | "missing_item" | "other",
 *     "description": "Received a brake pad set instead of the air filter." }
 */
import { createFileRoute } from "@tanstack/react-router";

import { databaseError, resolveCaller, zodDetails } from "@/lib/api/auth";
import { apiError, json, methodNotAllowed, preflight, readJson } from "@/lib/api/http";
import { reportIssueSchema } from "@/lib/api/orders";

export const Route = createFileRoute("/api/orders/$id/report-issue")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),

      POST: async ({ request, params }) => {
        const auth = await resolveCaller(request);
        if (!auth.ok) return auth.response;
        const { caller } = auth;

        const body = await readJson(request);
        if (!body.ok) return body.response;

        const parsed = reportIssueSchema.safeParse(body.value);
        if (!parsed.success) {
          return apiError(
            "bad_request",
            "The issue report is not valid.",
            zodDetails(parsed.error),
          );
        }

        const { data, error } = await caller.db.rpc("report_order_issue", {
          p_order_id: params.id,
          p_issue_type: parsed.data.issue_type,
          p_description: parsed.data.description,
        });

        if (error) return databaseError(error);

        const ticket = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
        if (!ticket?.["id"]) {
          return apiError("server_error", "The ticket was not created. Try again.");
        }

        return json(
          {
            data: {
              id: String(ticket["id"]),
              order_id: String(ticket["order_id"]),
              issue_type: String(ticket["issue_type"]),
              description: String(ticket["description"]),
              status: String(ticket["status"]),
              created_at: ticket["created_at"] ?? null,
            },
          },
          201,
        );
      },

      GET: () => methodNotAllowed(["POST", "OPTIONS"]),
    },
  },
});
