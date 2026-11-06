/**
 * JSON fallback for `/api/*`.
 *
 * Without this, a mistyped endpoint falls through to the SPA shell and a mobile
 * client receives HTML with a 200. An API should answer in the format it
 * promises, so every unknown `/api/...` path gets the standard error envelope.
 */
import { createFileRoute } from "@tanstack/react-router";

import { apiError, preflight } from "@/lib/api/http";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      ANY: () => apiError("not_found", "No API endpoint exists at this path. See docs/api.md."),
    },
  },
});
