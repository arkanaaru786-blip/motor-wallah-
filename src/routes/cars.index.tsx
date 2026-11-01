import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy car browse page — the BUY catalogue is the only listing page. */
export const Route = createFileRoute("/cars/")({
  beforeLoad: () => {
    throw redirect({ to: "/buy", search: { category: "cars" }, replace: true });
  },
});
