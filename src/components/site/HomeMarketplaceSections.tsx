import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  ChevronRight,
  FileCheck2,
  GitCompareArrows,
  Handshake,
  Heart,
  IndianRupee,
  MapPin,
  Package,
  Recycle,
  ShieldCheck,
  ShoppingBag,
  Store,
  Umbrella,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MakeOfferDialog } from "@/components/buy/MakeOfferDialog";
import { gateCustomerAction } from "@/lib/customer-gate";
import { useShortlist } from "@/lib/shortlist";
import { BUY_CATEGORY_LIST, getBuyListing, lakhLabel, listingsInCategory } from "@/lib/buy-catalog";
import franchiseShowroom from "@/assets/franchise-showroom.jpg";
import businessSpotlight from "@/assets/business-spotlight.jpg";
import carPhoto from "@/assets/homepage/Car.png";

// Every card opens the SAME unified BUY listing page — ids come straight from
// the BUY catalogue, so there is no second listing design anywhere.
const CAR_LISTING = listingsInCategory("cars").find(
  (listing) => listing.demo && listing.status === "Available",
);
const LISTINGS = [
  ...(CAR_LISTING ? [{ listing: CAR_LISTING, image: carPhoto }] : []),
  ...BUY_CATEGORY_LIST.filter((c) => c.id !== "cars").flatMap((category) => {
    const listing = listingsInCategory(category.id)[0];
    return listing ? [{ listing, image: category.image }] : [];
  }),
];

const ACTIONS = [
  { label: "Buy", to: "/buy", icon: ShoppingBag, text: "Find your next ride" },
  { label: "Sell", to: "/sell-your-car", icon: Store, text: "Get the best value" },
  { label: "Exchange", to: "/exchange", icon: ArrowLeftRight, text: "Upgrade easily" },
  { label: "Value", to: "/sell-your-car", icon: Calculator, text: "Know your worth" },
  { label: "Compare", to: "/compare", icon: GitCompareArrows, text: "Make the right choice" },
  { label: "Service", to: "/services", icon: Wrench, text: "Keep it running" },
  { label: "Scrap", to: "/scrap", icon: Recycle, text: "Turn old into value" },
] as const;

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Verified Vehicles",
    text: "Carefully verified for quality and ownership.",
  },
  {
    icon: FileCheck2,
    title: "Transparent Information",
    text: "Clear vehicle details and available records.",
  },
  {
    icon: ShieldCheck,
    title: "Inspection & Certification",
    text: "Multi-point inspection and certification.",
  },
  {
    icon: Handshake,
    title: "Trusted Partners",
    text: "Automotive network across the marketplace.",
  },
  {
    icon: IndianRupee,
    title: "Finance Assistance",
    text: "Support through relevant lending partners.",
  },
  {
    icon: Umbrella,
    title: "Insurance Assistance",
    text: "Insurance support through relevant providers.",
  },
] as const;

// Parts, services, finance, insurance and scrap — links into existing routes only.
const HUB = [
  {
    title: "New Auto Parts",
    text: "Browse new parts and accessories for your vehicle.",
    to: "/accessories",
    icon: Package,
    cta: "Browse new parts",
    lead: true,
    wide: false,
  },
  {
    title: "Second-Hand Auto Parts",
    text: "Explore second-hand parts available across the marketplace.",
    to: "/accessories",
    icon: Recycle,
    cta: "Browse used parts",
    lead: false,
    wide: false,
  },
  {
    title: "Vehicle Services",
    text: "Inspection, workshop, detailing and RTO documentation.",
    to: "/services",
    icon: Wrench,
    cta: "Explore services",
    lead: false,
    wide: false,
  },
  {
    title: "Finance",
    text: "Finance assistance through relevant lending partners.",
    to: "/finance",
    icon: IndianRupee,
    cta: "Explore finance",
    lead: false,
    wide: false,
  },
  {
    title: "Insurance",
    text: "Insurance assistance through relevant providers.",
    to: "/insurance",
    icon: ShieldCheck,
    cta: "Explore insurance",
    lead: false,
    wide: false,
  },
  {
    title: "Scrap",
    text: "Turn your old vehicle into value with Motor Wallah.",
    to: "/contact",
    icon: Recycle,
    cta: "Scrap a vehicle",
    lead: false,
    wide: true,
  },
] as const;

export function FranchiseBanner() {
  return (
    <section className="home-franchise">
      <div className="home-container">
        <div className="home-franchise-panel">
          <div className="home-franchise-content">
            <p className="home-franchise-eyebrow">Franchise opportunity</p>
            <h2>
              Become a <span>Franchise Partner</span>
            </h2>
            <p>Join Motor Wallah and grow your automotive business with us.</p>
            <Button asChild className="home-cta home-cta-primary">
              <Link to="/franchise">
                Apply Now <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
          <div className="home-franchise-media">
            <img
              src={franchiseShowroom}
              alt="Premium automotive franchise showroom"
              width={1920}
              height={720}
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketplaceHub() {
  return (
    <section className="home-hub">
      <div className="home-container">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Marketplace & Support</p>
            <h2>
              Parts, Services, <span>Finance & More</span>
            </h2>
            <p>Everything around the vehicle — parts, service, finance, insurance and scrap.</p>
          </div>
        </div>

        <div className="home-hub-grid">
          {HUB.map(({ title, text, to, icon: Icon, cta, lead, wide }) => (
            <Link
              key={title}
              to={to}
              className={`home-hub-card${lead ? " home-hub-card-lead" : ""}${wide ? " home-hub-card-wide" : ""}`}
            >
              <span className="home-hub-icon">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span className="home-hub-body">
                <span className="home-hub-title">{title}</span>
                <span className="home-hub-text">{text}</span>
              </span>
              <span className="home-hub-cta">
                {cta} <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BusinessSpotlight() {
  return (
    <section className="home-spotlight">
      <div className="home-container">
        <div className="home-spotlight-card">
          <img
            src={businessSpotlight}
            alt="ABC Auto Care workshop"
            width={1280}
            height={720}
            loading="lazy"
            className="home-spotlight-image"
          />
          <div className="home-spotlight-body">
            <p className="home-spotlight-tag">Business Spotlight · Advertisement</p>
            <h2>ABC Auto Care</h2>
            <p className="home-spotlight-text">Complete Car Service • AC • Denting • Painting</p>
            <p className="home-spotlight-place">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Indore
            </p>
            <Link to="/services" className="home-spotlight-link">
              View details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="home-spotlight-action">
            <Button asChild variant="outline" className="home-cta home-cta-outline">
              <Link to="/contact">
                <Building2 /> Advertise Your Business
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PopularVehicles() {
  const shortlist = useShortlist();
  const [offerId, setOfferId] = useState<string | null>(null);
  const offerListing = offerId ? (getBuyListing(offerId) ?? null) : null;

  return (
    <section className="home-popular">
      <div className="home-container">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Featured Listings</p>
            <h2>
              Popular <span>Vehicles</span>
            </h2>
            <p>Top picks from our marketplace · Demo listings</p>
          </div>
          <Link to="/buy" search={{ category: "cars" }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="home-listing-grid">
          {LISTINGS.map(({ listing, image }) => {
            const name = `${listing.brand} ${listing.model}`;
            const shortlisted = shortlist.has(listing.id);
            return (
              <article key={listing.id} className="home-listing-card">
                <div className="home-listing-image">
                  <img
                    src={image}
                    alt={`${name} ${listing.categoryLabel} illustrative demo photograph`}
                    width={720}
                    height={450}
                    loading="lazy"
                  />
                  <span className="home-demo-badge">Demo listing</span>
                  <button
                    type="button"
                    className="home-listing-fav"
                    aria-label={shortlisted ? `Remove ${name} from shortlist` : `Shortlist ${name}`}
                    aria-pressed={shortlisted}
                    onClick={() => shortlist.toggle(listing.id)}
                  >
                    <Heart
                      size={16}
                      fill={shortlisted ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div className="home-listing-body">
                  <p className="home-listing-brand">{listing.brand}</p>
                  <h3>{name}</h3>
                  <p className="home-listing-variant">{listing.categoryLabel}</p>
                  <p className="home-listing-meta">
                    {listing.year} · {listing.fuel}
                  </p>
                  <p className="home-listing-meta">
                    {listing.kilometres !== null
                      ? `${listing.kilometres.toLocaleString("en-IN")} km`
                      : "Km on request"}{" "}
                    · {listing.city}
                  </p>
                  <p className="home-listing-price">{lakhLabel(listing.priceLakh)}</p>
                  <div className="home-listing-actions">
                    <Button asChild size="sm" className="home-listing-button">
                      <Link to="/buy/vehicle/$id" params={{ id: listing.id }}>
                        View Details <ArrowRight size={12} />
                      </Link>
                    </Button>
                    <button
                      type="button"
                      className="home-listing-offer"
                      onClick={() => gateCustomerAction("offer", () => setOfferId(listing.id))}
                    >
                      Make an Offer
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {offerListing && (
          <MakeOfferDialog listing={offerListing} open onClose={() => setOfferId(null)} />
        )}
      </div>
    </section>
  );
}

export function MarketplaceActions() {
  return (
    <section className="home-action-section">
      <div className="home-container">
        <div className="home-action-panel">
          <div className="home-action-intro">
            <h2>Quick Actions</h2>
            <p>What do you want to do today?</p>
          </div>
          <div className="home-action-options">
            {ACTIONS.map(({ icon: Icon, ...item }) => (
              <Link key={item.label} to={item.to}>
                <Icon size={22} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.text}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="home-trust">
      <div className="home-container">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Built On Trust</p>
            <h2>
              Why Motor <span>Wallah</span>
            </h2>
            <p>More than just a marketplace — we build trust.</p>
          </div>
        </div>
        <div className="home-trust-grid">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="home-trust-card">
              <Icon className="home-trust-icon" strokeWidth={1.5} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
