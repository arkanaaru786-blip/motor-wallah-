import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Handshake,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL, WHATSAPP } from "@/lib/site";

const TITLE = "About Motor Wallah | Every Vehicle. One Marketplace.";
const DESCRIPTION =
  "Motor Wallah is an Indore-based vehicle marketplace for buying, selling, exchanging and servicing cars, bikes, three-wheelers, commercial vehicles and tractors.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const PILLARS = [
  {
    icon: BadgeCheck,
    title: "Transparent information",
    text: "Clear vehicle details, ownership records and pricing so a buyer can decide without guesswork.",
  },
  {
    icon: ShieldCheck,
    title: "Inspection first",
    text: "Listings can carry a completed Motor Wallah inspection, and we never label a vehicle verified before that check exists.",
  },
  {
    icon: Handshake,
    title: "One trusted network",
    text: "Dealers, workshops, finance and insurance partners work from the same marketplace instead of separate silos.",
  },
  {
    icon: Wrench,
    title: "Support after the sale",
    text: "Service, RTO paperwork, warranty and roadside assistance stay available once the vehicle is home.",
  },
] as const;

function Page() {
  return (
    <div className="mw-home min-h-screen bg-background pb-16 md:pb-0">
      <SiteHeader />
      <main className="mw-info">
        <section className="mw-info-hero">
          <div className="home-container">
            <p className="mw-info-eyebrow">
              <MapPin size={14} /> Indore, Madhya Pradesh
            </p>
            <h1>
              One marketplace for <span>every vehicle.</span>
            </h1>
            <p className="mw-info-lede">
              Motor Wallah brings buying, selling, exchanging, valuing and servicing into a single
              place — for cars, bikes, three-wheelers, small commercial vehicles, trucks, buses and
              tractors.
            </p>
            <div className="mw-info-actions">
              <Link to="/buy" className="mw-info-button">
                Browse vehicles <ArrowRight size={15} />
              </Link>
              <Link to="/sell-your-car" className="mw-info-button mw-info-button--ghost">
                Sell your vehicle
              </Link>
            </div>
          </div>
        </section>

        <section className="mw-info-section">
          <div className="home-container">
            <div className="mw-info-heading">
              <p className="mw-info-kicker">Our mission</p>
              <h2>
                Make every vehicle deal <span>straightforward.</span>
              </h2>
              <p>
                We started in Indore with a simple observation: vehicle transactions are full of
                gaps — incomplete histories, unclear pricing and services scattered across different
                businesses. Motor Wallah closes those gaps by keeping the listing, the inspection,
                the finance conversation and the after-sales support in one account.
              </p>
            </div>

            <div className="mw-info-grid">
              {PILLARS.map(({ icon: Icon, title, text }) => (
                <article key={title} className="mw-info-card">
                  <span className="mw-info-card-icon">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mw-info-section mw-info-section--last">
          <div className="home-container">
            <div className="mw-info-contact">
              <div>
                <p className="mw-info-kicker">Talk to us</p>
                <h2>Based in Indore. Working across India.</h2>
                <p>
                  Our team handles listings, inspections, franchise partnerships and customer
                  support from Indore. Reach out for anything from a vehicle query to a partnership
                  conversation.
                </p>
              </div>
              <div className="mw-info-contact-links">
                <a href={PHONE_HREF} className="mw-info-contact-link">
                  <Phone size={16} /> {PHONE_DISPLAY}
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="mw-info-contact-link">
                  <Mail size={16} /> {SUPPORT_EMAIL}
                </a>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mw-info-contact-link"
                >
                  <Handshake size={16} /> WhatsApp the team
                </a>
                <span className="mw-info-contact-link">
                  <MapPin size={16} /> Indore, Madhya Pradesh
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
