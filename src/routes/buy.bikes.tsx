import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Bikes page — Bikes now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/bikes")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "bikes" }, replace: true });
  },
});
