/**
 * Small helpers shared by every `/api/*` server route.
 *
 * The routes return raw `Response` objects (TanStack Start server routes, not
 * server functions) because the mobile apps for dealers, workshops, parts and
 * decor call them over HTTP with a bearer token, exactly like any third-party
 * API would.
 */

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "method_not_allowed"
  | "database_not_ready"
  | "server_error";

/** One error shape for every endpoint, so the apps need a single parser. */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level detail from validation, when there is any. */
    details?: Record<string, string[]>;
  };
};

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  method_not_allowed: 405,
  database_not_ready: 503,
  server_error: 500,
};

/**
 * Mobile clients are native apps, so there is no cookie to protect: the caller
 * always authenticates with `Authorization: Bearer <supabase access token>`.
 * That makes a wildcard origin safe (nothing is sent automatically) and keeps
 * the API callable from a web dashboard on any domain.
 */
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
  vary: "origin",
};

function withCors(headers: Headers): Headers {
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return headers;
}

/** JSON success response. `status` defaults to 200, use 201 for creates. */
export function json(data: unknown, status = 200): Response {
  const headers = withCors(
    new Headers({
      "content-type": "application/json; charset=utf-8",
      // Order and ticket responses are per-customer data: never cache them.
      "cache-control": "no-store",
    }),
  );
  return new Response(JSON.stringify(data), { status, headers });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, string[]>,
): Response {
  const body: ApiErrorBody = { error: details ? { code, message, details } : { code, message } };
  const headers = withCors(
    new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }),
  );
  return new Response(JSON.stringify(body), { status: STATUS[code], headers });
}

/** CORS preflight. Every route exposes this so the apps can call it directly. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: withCors(new Headers()) });
}

/** Method listed but not implemented on this path. */
export function methodNotAllowed(allowed: string[]): Response {
  const response = apiError("method_not_allowed", `Use one of: ${allowed.join(", ")}.`);
  response.headers.set("allow", allowed.join(", "));
  return response;
}

/**
 * Parses a JSON body with a size guard. The apps only ever send a handful of
 * line items, so anything larger than 100 kB is a mistake or an attack.
 */
export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    return {
      ok: false,
      response: apiError("bad_request", "Send the body as application/json."),
    };
  }

  const text = await request.text().catch(() => "");
  if (text.length > 100_000) {
    return { ok: false, response: apiError("bad_request", "Request body is too large.") };
  }
  if (text.trim() === "") {
    return { ok: false, response: apiError("bad_request", "Request body is empty.") };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: apiError("bad_request", "Request body is not valid JSON.") };
  }
}
