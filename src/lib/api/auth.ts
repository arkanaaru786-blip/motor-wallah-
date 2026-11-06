/**
 * Caller resolution for the API layer.
 *
 * Every `/api/*` handler starts here. The caller proves who they are with a
 * Supabase access token in `Authorization: Bearer …`; the token is verified
 * against Supabase Auth, and the resulting user id — never a client-supplied
 * `customer_id` or `owner_id` — is what the handlers scope their queries to.
 *
 * The Supabase client built here carries that same token on every PostgREST
 * call, so the row level security policies in `supabase/orders-helpdesk.sql`
 * are what actually decide which rows come back. The checks in the handlers
 * are a second, explicit gate (defence in depth), not the only one.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ZodError } from "zod";

import { apiError, type ApiErrorCode } from "@/lib/api/http";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";

export type Caller = {
  userId: string;
  email: string | null;
  isAnonymous: boolean;
  token: string;
  /** Runs as the caller: RLS applies to it. */
  db: SupabaseClient;
};

export type CallerResult = { ok: true; caller: Caller } | { ok: false; response: Response };

/**
 * Token verification client.
 *
 * It must NOT carry the caller's token in `global.headers`: supabase-js sends
 * that header instead of the `jwt` argument, and GoTrue then answers
 * "This endpoint requires a valid Bearer token". Verification and querying are
 * therefore two different clients.
 */
const validator: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { "x-application-name": "motor-wallah-api" } },
});

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export async function resolveCaller(request: Request): Promise<CallerResult> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: apiError(
        "unauthorized",
        "Send a Supabase access token as `Authorization: Bearer <token>`.",
      ),
    };
  }

  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: apiError("unauthorized", "That access token is invalid or has expired."),
    };
  }

  const user = data.user;

  // Queries run as this user: PostgREST receives the caller's token, so the RLS
  // policies decide what is visible.
  const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: {
        authorization: `Bearer ${token}`,
        "x-application-name": "motor-wallah-api",
      },
    },
  });

  return {
    ok: true,
    caller: {
      userId: user.id,
      email: user.email ?? null,
      isAnonymous: Boolean(user.is_anonymous),
      token,
      db,
    },
  };
}

/** Turns a Zod failure into the API's standard `details` map. */
export function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Maps a PostgREST / Postgres error from one of the `place_order` or
 * `report_order_issue` functions to an HTTP response. The SQL raises with a
 * short machine-readable message, which keeps the mapping in one place.
 */
export function databaseError(error: {
  message?: string;
  code?: string;
  details?: string;
}): Response {
  const message = error.message ?? "";
  const known: Record<string, [ApiErrorCode, string]> = {
    not_authenticated: ["unauthorized", "Sign in before calling the API."],
    not_your_order: ["forbidden", "That order belongs to a different customer."],
    order_not_found: ["not_found", "No order exists with that id."],
    shop_not_found: ["bad_request", "The shop_id does not match an active shop."],
    no_items: ["bad_request", "Send at least one line item."],
    too_many_items: ["bad_request", "An order can hold at most 100 line items."],
    invalid_item: [
      "bad_request",
      "Every item needs a product_id, quantity above zero and a price of zero or more.",
    ],
    invalid_item_type: ["bad_request", 'item_type must be "parts" or "decor".'],
    invalid_issue_type: [
      "bad_request",
      "issue_type must be wrong_item, damaged_item, missing_item or other.",
    ],
    invalid_description: ["bad_request", "Describe the problem in 10 characters or more."],
    issue_already_open: ["conflict", "A ticket for this order and issue type is already open."],
    order_cancelled: ["conflict", "A cancelled order cannot be reported."],
  };

  for (const [needle, [code, text]] of Object.entries(known)) {
    if (message.includes(needle)) return apiError(code, text);
  }

  // The SQL in supabase/orders-helpdesk.sql has not been run against this
  // project yet. PostgREST reports each missing piece with its own code:
  //   PGRST205/42P01 table missing, PGRST200 relationship missing,
  //   PGRST202/42883 function missing. Answer 503 with the fix, not a mute 500.
  if (
    error.code === "42883" ||
    error.code === "42P01" ||
    error.code === "PGRST200" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table|could not find the function|could not find a relationship/i.test(
      message,
    )
  ) {
    return apiError(
      "database_not_ready",
      "The orders tables are not set up yet. Run supabase/orders-helpdesk.sql in the Supabase SQL editor.",
    );
  }

  return apiError("server_error", "The database rejected that request.");
}
