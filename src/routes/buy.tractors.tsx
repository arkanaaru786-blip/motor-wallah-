import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Tractors page — Tractors now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/tractors")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "tractors" }, replace: true });
  },
});
