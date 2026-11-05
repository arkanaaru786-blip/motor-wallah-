import type { ReactNode } from "react";
import {
  Car,
  HandCoins,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import { signOutDealer, type DealerSession } from "@/lib/dealer-session";

export type DealerTab = "overview" | "inventory" | "add" | "leads" | "offers";

const TABS: { id: DealerTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "My Inventory", icon: Car },
  { id: "add", label: "Add Vehicle", icon: PlusCircle },
  { id: "leads", label: "Leads", icon: Users },
  { id: "offers", label: "Offers", icon: HandCoins },
];

export function DealerShell({
  session,
  active,
  onTab,
  counts,
  children,
}: {
  session: DealerSession;
  active: DealerTab;
  onTab: (tab: DealerTab) => void;
  counts: Partial<Record<DealerTab, number>>;
  children: ReactNode;
}) {
  const category = dealerCategoryLabel(session.category);

  return (
    <div className="mw-dealer">
      <header className="mw-dealer-top">
        <div className="mw-dealer-brand">
          <span className="mw-dealer-brand-mark" aria-hidden="true">
            <Store size={19} />
          </span>
          <div>
            <strong>Motor Wallah Dealer</strong>
            <span>{session.showroom}</span>
          </div>
        </div>

        {/* The category is the account's whole scope — stated, not chosen. */}
        <span className="mw-dealer-scope" data-testid="dealer-scope">
          <ShieldCheck size={13} /> {category} only
        </span>

        <div className="mw-dealer-top-right">
          <div className="mw-dealer-identity">
            <strong>{session.name}</strong>
            <span>
              {session.dealerId} · {session.email}
            </span>
          </div>
          <button
            type="button"
            className="mw-dealer-btn is-quiet"
            onClick={() => signOutDealer()}
            data-testid="dealer-signout"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <nav className="mw-dealer-nav" aria-label="Dealer portal sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active === tab.id ? "page" : undefined}
              onClick={() => onTab(tab.id)}
              data-testid={`dealer-tab-${tab.id}`}
            >
              <Icon size={15} /> {tab.label}
              {typeof count === "number" && count > 0 ? (
                <span className="mw-dealer-nav-count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main className="mw-dealer-main">{children}</main>
    </div>
  );
}
