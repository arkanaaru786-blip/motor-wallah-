import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Warranty and roadside assistance now share one page with its own lead form.
 * The older single-service URLs redirect there so every existing link lands on
 * real content instead of a "coming soon" placeholder.
 */
export const Route = createFileRoute("/roadside-assistance")({
  beforeLoad: () => {
    throw redirect({ to: "/warranty-rsa" });
  },
});
