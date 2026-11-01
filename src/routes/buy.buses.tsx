import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Buses page — Buses now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/buses")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "buses" }, replace: true });
  },
});
