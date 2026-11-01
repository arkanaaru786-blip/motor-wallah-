import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy 3-Wheelers page — 3-Wheelers now lives in the unified BUY catalogue. */
export const Route = createFileRoute("/buy/three-wheelers")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "three-wheelers" }, replace: true });
  },
});
