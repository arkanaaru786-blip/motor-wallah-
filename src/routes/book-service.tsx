import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * Legacy route kept for old links/bookmarks: "Book Service" now lives at
 * /services (category grid first). Anything landing here is redirected so no
 * user ever sees the old placeholder page again.
 */
export const Route = createFileRoute("/book-service")({
  component: () => <Navigate to="/services" />,
});
