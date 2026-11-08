import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { OrderPortal } from "@/components/partner/OrderPortal";
import { currentPartner, usePartnerSession } from "@/lib/partner-session";

export const Route = createFileRoute("/decor-partner")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentPartner("decor")) throw redirect({ to: "/decor-login" });
  },
  head: () => ({
    meta: [
      { title: "Decor Partner Portal | Motor Wallah" },
      {
        name: "description",
        content: "Vehicle decor partner desk: order fulfilment, invoices and inventory.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DecorPartnerRoute,
});

function DecorPartnerRoute() {
  const { ready, session } = usePartnerSession("decor");
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/decor-login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="mw-dealer mw-dealer-loading mw-partner" aria-busy="true">
        <span className="mw-dealer-loading-dot" />
        Opening your decor partner portal…
      </div>
    );
  }

  return <OrderPortal session={session} />;
}
