import { createFileRoute, redirect } from "@tanstack/react-router";

import { PartnerLogin } from "@/components/partner/PartnerLogin";
import { currentPartner } from "@/lib/partner-session";

export const Route = createFileRoute("/workshop-login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (currentPartner("workshop")) throw redirect({ to: "/workshop" });
  },
  head: () => ({
    meta: [
      { title: "Workshop Login | Motor Wallah" },
      {
        name: "description",
        content: "Workshop partner portal sign in with your Motor Wallah workshop ID.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WorkshopLoginRoute,
});

function WorkshopLoginRoute() {
  return <PartnerLogin type="workshop" />;
}
