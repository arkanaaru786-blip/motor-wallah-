import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy SCV / Mini Trucks page — SCV / Mini Trucks now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/scv")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "scv" }, replace: true });
  },
});
