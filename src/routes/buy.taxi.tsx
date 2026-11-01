import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Taxi / Commercial Cars page — Taxi / Commercial Cars now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/taxi")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "taxi" }, replace: true });
  },
});
