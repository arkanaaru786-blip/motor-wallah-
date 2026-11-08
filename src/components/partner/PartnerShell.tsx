import type { ReactNode } from "react";
import { LayoutDashboard, LogOut, Package, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import { getPartnerType } from "@/lib/partners";
import { signOutPartner, type PartnerSession } from "@/lib/partner-session";

export type PartnerTab = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number;
};

const PORTAL_ICON = {
  workshop: Wrench,
  parts: Package,
  decor: Sparkles,
} as const;

/**
 * Glass shell shared by the three partner portals. It reuses the dealer
 * portal's light-theme surface classes so all four partner desks look and
 * behave the same, while the header states the one account scope in use.
 */
export function PartnerShell({
  session,
  tabs,
  active,
  onTab,
  children,
}: {
  session: PartnerSession;
  tabs: PartnerTab[];
  active: string;
  onTab: (tab: string) => void;
  children: ReactNode;
}) {
  const type = getPartnerType(session.type);
  const Icon = PORTAL_ICON[session.type];

  return (
    <div className="mw-dealer mw-partner" data-partner-type={session.type}>
      <header className="mw-dealer-top">
        <div className="mw-dealer-brand">
          <span className="mw-dealer-brand-mark" aria-hidden="true">
            <Icon size={19} />
          </span>
          <div>
            <strong>Motor Wallah {type.label} Portal</strong>
            <span>{session.business}</span>
          </div>
        </div>

        <span className="mw-dealer-scope" data-testid="partner-scope">
          <ShieldCheck size={13} /> {session.partnerId}
        </span>

        <div className="mw-dealer-top-right">
          <div className="mw-dealer-identity">
            <strong>{session.name}</strong>
            <span>
              {session.city} · {session.mobile}
            </span>
          </div>
          <button
            type="button"
            className="mw-dealer-btn is-quiet"
            onClick={() => signOutPartner(session.type)}
            data-testid="partner-signout"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <nav className="mw-dealer-nav" aria-label={`${type.label} portal sections`}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const count = tab.count;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active === tab.id ? "page" : undefined}
              onClick={() => onTab(tab.id)}
              data-testid={`partner-tab-${tab.id}`}
            >
              <TabIcon size={15} /> {tab.label}
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
