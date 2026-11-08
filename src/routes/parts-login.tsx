import { createFileRoute, redirect } from "@tanstack/react-router";

import { PartnerLogin } from "@/components/partner/PartnerLogin";
import { currentPartner } from "@/lib/partner-session";

export const Route = createFileRoute("/parts-login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (currentPartner("parts")) throw redirect({ to: "/parts" });
  },
  head: () => ({
    meta: [
      { title: "Auto Parts Login | Motor Wallah" },
      {
        name: "description",
        content: "Auto parts partner portal sign in with your Motor Wallah shop ID.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PartsLoginRoute,
});

function PartsLoginRoute() {
  return <PartnerLogin type="parts" />;
}
