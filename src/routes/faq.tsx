import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The FAQ page lives at /faqs. This route keeps the older /faq link working for
 * anyone who bookmarked it, without maintaining two copies of the content.
 */
export const Route = createFileRoute("/faq")({
  beforeLoad: () => {
    throw redirect({ to: "/faqs" });
  },
});
