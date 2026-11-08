import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { WorkshopPortal } from "@/components/partner/WorkshopPortal";
import { currentPartner, usePartnerSession } from "@/lib/partner-session";

export const Route = createFileRoute("/workshop")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentPartner("workshop")) throw redirect({ to: "/workshop-login" });
  },
  head: () => ({
    meta: [
      { title: "Workshop Portal | Motor Wallah" },
      {
        name: "description",
        content:
          "Workshop partner desk: job cards, mechanic notes, parts used and delivery status.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WorkshopRoute,
});

function WorkshopRoute() {
  const { ready, session } = usePartnerSession("workshop");
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/workshop-login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="mw-dealer mw-dealer-loading mw-partner" aria-busy="true">
        <span className="mw-dealer-loading-dot" />
        Opening your workshop portal…
      </div>
    );
  }

  return <WorkshopPortal session={session} />;
}
