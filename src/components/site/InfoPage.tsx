import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL, WHATSAPP } from "@/lib/site";

/** Support and policy pages listed in the aside of every info page. */
const SUPPORT_NAV = [
  { label: "Contact us", to: "/contact" },
  { label: "FAQs", to: "/faqs" },
  { label: "RTO services", to: "/rto" },
  { label: "Warranty & RSA", to: "/warranty-rsa" },
  { label: "Privacy policy", to: "/privacy" },
  { label: "Terms & conditions", to: "/terms" },
  { label: "Refund & cancellation", to: "/refund" },
  { label: "Disclaimer", to: "/disclaimer" },
] as const;

/**
 * Shared frame for the public information pages.
 *
 * Light glass presentation: a soft grey page, translucent white panels with
 * backdrop blur and hairline borders. Header, footer and the mobile action bar
 * are the site's existing chrome, so these pages behave like every other route.
 */
export function InfoPage({
  eyebrow,
  title,
  lead,
  meta,
  children,
  aside,
  updated,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  meta?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  updated?: string;
}) {
  return (
    <div id="top" className="mw-info flex min-h-screen flex-col pb-14 md:pb-0">
      <SiteHeader />
      <main className="flex-1">
        <section className="mw-info-hero">
          <div className="mw-info-shell">
            <p className="mw-info-eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 className="mw-info-title">{title}</h1>
            <p className="mw-info-lead">{lead}</p>
            {meta ? <div className="mw-info-hero-meta">{meta}</div> : null}
          </div>
        </section>

        <div className="mw-info-body">
          <div className="mw-info-shell">
            <div className="mw-info-columns">
              <div className="mw-info-main">
                {children}
                {updated ? <p className="mw-info-updated">Last updated {updated}</p> : null}
              </div>
              <aside className="mw-info-aside">
                {aside}
                <InfoNav />
                <HelpCard />
              </aside>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}

/** A glass card used for every section on an info page. */
export function InfoPanel({
  title,
  subtitle,
  icon,
  children,
  tight,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={`mw-info-panel${tight ? " mw-info-panel--tight" : ""}`}>
      {title ? (
        <div className="mw-info-panel-head">
          {icon ? <span className="mw-info-panel-icon">{icon}</span> : null}
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="mw-info-panel-sub">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function InfoNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="mw-info-panel mw-info-panel--tight">
      <p className="mw-info-tile-label">Support &amp; policies</p>
      <nav aria-label="Support and policy pages" className="mw-info-nav mt-2">
        {SUPPORT_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            data-status={pathname === item.to ? "active" : undefined}
          >
            {item.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </div>
  );
}

function HelpCard() {
  return (
    <div className="mw-info-panel mw-info-panel--tight">
      <p className="mw-info-tile-label">Need a hand?</p>
      <div className="mw-info-help mt-3">
        <a href={PHONE_HREF}>
          <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>
            Call us
            <small>{PHONE_DISPLAY}</small>
          </span>
        </a>
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>
            WhatsApp
            <small>Chat with the team</small>
          </span>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>
            Email
            <small>{SUPPORT_EMAIL}</small>
          </span>
        </a>
      </div>
    </div>
  );
}

/** Bulleted list with a red check for each confirmed item. */
export function InfoChecks({ items }: { items: string[] }) {
  return (
    <ul className="mw-info-checks">
      {items.map((item) => (
        <li key={item}>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
