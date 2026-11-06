import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { DealerAddVehicle } from "@/components/dealer/DealerAddVehicle";
import { DealerChats } from "@/components/dealer/DealerChats";
import { DealerInventory } from "@/components/dealer/DealerInventory";
import { DealerLeads } from "@/components/dealer/DealerLeads";
import { DealerOffers } from "@/components/dealer/DealerOffers";
import { DealerOverview } from "@/components/dealer/DealerOverview";
import { DealerShell, type DealerTab } from "@/components/dealer/DealerShell";
import { dealerBook, dealerKpis, seedDealerData } from "@/lib/dealer-data";
import { currentDealer, useDealerSession } from "@/lib/dealer-session";
import { ensureDealers } from "@/lib/dealers";
import { claimDealer, useChatInbox } from "@/lib/live-chat";

const DEALER_TABS: DealerTab[] = ["overview", "inventory", "add", "leads", "chats", "offers"];

export const Route = createFileRoute("/dealer")({
  // Lets other pages (e.g. the old Seller Desk link) open a specific tab.
  validateSearch: (search: Record<string, unknown>): { tab?: DealerTab | undefined } => {
    const tab = search["tab"];
    return {
      tab: DEALER_TABS.find((id) => id === tab),
    };
  },
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentDealer()) throw redirect({ to: "/dealer-login" });
  },
  head: () => ({
    meta: [
      { title: "Dealer Portal | Motor Wallah" },
      { name: "description", content: "Category-restricted dealer inventory, leads and offers." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DealerPortal,
});

function DealerPortal() {
  const { ready, session } = useDealerSession();
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const [tab, setTab] = useState<DealerTab>(tabParam ?? "overview");
  const [version, setVersion] = useState(0);
  const [seeded, setSeeded] = useState(false);
  // Chat inbox: its own source (Supabase) and the red badge on "My Chats".
  const chats = useChatInbox("dealer", session?.dealerId);

  // Registering this browser as the dealer's is what lets RLS hand it the
  // dealer's conversations; it is idempotent and safe to repeat.
  useEffect(() => {
    if (session) void claimDealer(session.dealerId, session.showroom);
  }, [session]);

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/dealer-login", replace: true });
  }, [ready, session, navigate]);

  // Demo book for this dealer's category, created once on first open.
  useEffect(() => {
    if (!session) return;
    void ensureDealers().then(() => {
      seedDealerData(session);
      setSeeded(true);
    });
  }, [session]);

  const book = useMemo(() => {
    if (!session) return null;
    return dealerBook(session);
    // `version` is the manual refresh trigger for every write in the panels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, version, seeded]);

  const refresh = () => setVersion((value) => value + 1);

  if (!ready || !session) {
    return (
      <div className="mw-dealer mw-dealer-loading" aria-busy="true">
        <span className="mw-dealer-loading-dot" />
        Opening your dealer portal…
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mw-dealer mw-dealer-loading" aria-busy="true">
        <span className="mw-dealer-loading-dot" />
        Loading your inventory…
      </div>
    );
  }

  const kpis = dealerKpis(session, book);

  return (
    <DealerShell
      session={session}
      active={tab}
      onTab={setTab}
      counts={{
        inventory: book.vehicles.length,
        leads: book.leads.filter((lead) => lead.status === "New").length,
        offers: book.offers.filter((offer) => offer.status === "Pending").length,
        chats: chats.unread,
      }}
    >
      {tab === "overview" ? (
        <DealerOverview session={session} book={book} kpis={kpis} onTab={setTab} />
      ) : null}

      {tab === "inventory" ? (
        <DealerInventory session={session} vehicles={book.vehicles} refresh={refresh} />
      ) : null}

      {tab === "add" ? (
        <DealerAddVehicle
          session={session}
          onAdded={refresh}
          goToInventory={() => setTab("inventory")}
        />
      ) : null}

      {tab === "leads" ? (
        <DealerLeads session={session} leads={book.leads} refresh={refresh} />
      ) : null}

      {tab === "chats" ? <DealerChats session={session} /> : null}

      {tab === "offers" ? (
        <DealerOffers session={session} offers={book.offers} refresh={refresh} />
      ) : null}
    </DealerShell>
  );
}
