import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Trucks page — Trucks now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/trucks")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "trucks" }, replace: true });
  },
});
