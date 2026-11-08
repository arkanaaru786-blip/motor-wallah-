import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { OrderPortal } from "@/components/partner/OrderPortal";
import { currentPartner, usePartnerSession } from "@/lib/partner-session";

export const Route = createFileRoute("/parts")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentPartner("parts")) throw redirect({ to: "/parts-login" });
  },
  head: () => ({
    meta: [
      { title: "Auto Parts Portal | Motor Wallah" },
      {
        name: "description",
        content: "Auto parts partner desk: order fulfilment, invoices and inventory.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PartsRoute,
});

function PartsRoute() {
  const { ready, session } = usePartnerSession("parts");
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/parts-login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="mw-dealer mw-dealer-loading mw-partner" aria-busy="true">
        <span className="mw-dealer-loading-dot" />
        Opening your auto parts portal…
      </div>
    );
  }

  return <OrderPortal session={session} />;
}
