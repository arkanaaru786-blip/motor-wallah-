import { createFileRoute, redirect } from "@tanstack/react-router";

import { PartnerLogin } from "@/components/partner/PartnerLogin";
import { currentPartner } from "@/lib/partner-session";

export const Route = createFileRoute("/decor-login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (currentPartner("decor")) throw redirect({ to: "/decor-partner" });
  },
  head: () => ({
    meta: [
      { title: "Decor Partner Login | Motor Wallah" },
      {
        name: "description",
        content: "Vehicle decor partner portal sign in with your Motor Wallah decor shop ID.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DecorLoginRoute,
});

function DecorLoginRoute() {
  return <PartnerLogin type="decor" />;
}
