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
import { BannerAd, BannerMedia, bannerLinkProps } from "@/components/site/BannerAd";
import { useActiveBanner, useBanners } from "@/lib/banners";
import { MakeOfferDialog } from "@/components/buy/MakeOfferDialog";
import { gateCustomerAction } from "@/lib/customer-gate";
import { useShortlist } from "@/lib/shortlist";
import {
  BUY_CATEGORY_LIST,
  HOME_POPULAR_LISTINGS,
  getBuyListing,
  lakhLabel,
} from "@/lib/buy-catalog";
import franchiseShowroom from "@/assets/franchise-showroom.jpg";
import businessSpotlight from "@/assets/business-spotlight.jpg";
import carPhoto from "@/assets/homepage/Car.png";

// Every card opens the SAME unified BUY listing page — ids come straight from
// the BUY catalogue, so there is no second listing design anywhere.
const CAR_LISTING = HOME_POPULAR_LISTINGS.find(
  (listing) => listing.categoryId === "cars" && listing.status === "Available",
);
const LISTINGS = [
  ...(CAR_LISTING ? [{ listing: CAR_LISTING, image: carPhoto }] : []),
  ...BUY_CATEGORY_LIST.filter((c) => c.id !== "cars").flatMap((category) => {
    const listing = HOME_POPULAR_LISTINGS.find(
      (entry) => entry.categoryId === category.id && entry.status === "Available",
    );
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

/**
 * Franchise banner.
 *
 * The artwork is whichever active image (or MP4) the control room has set for
 * the `franchise_banner` slot; with nothing set the bundled showroom photo is
 * used, so the section always looks the same as before. When a banner has a
 * target URL, the artwork is the link and the click is counted.
 */
export function FranchiseBanner() {
  const banner = useActiveBanner("franchise_banner");
  const link = banner ? bannerLinkProps(banner) : null;

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
            {banner ? (
              link ? (
                <a className="home-franchise-link" data-testid="franchise-banner-link" {...link}>
                  <BannerMedia banner={banner} />
                </a>
              ) : (
                <BannerMedia banner={banner} />
              )
            ) : (
              <img
                src={franchiseShowroom}
                alt="Premium automotive franchise showroom"
                width={1920}
                height={720}
                loading="lazy"
              />
            )}
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

/**
 * Business spotlight.
 *
 * The sponsored card reads the `business_spotlight` slot: its artwork replaces
 * the bundled workshop photo, its title replaces the demo brand name, and its
 * target URL replaces the internal “View details” link. With no active banner
 * the card is exactly the demo it has always been.
 */
export function BusinessSpotlight() {
  const banner = useActiveBanner("business_spotlight");
  const link = banner ? bannerLinkProps(banner) : null;

  return (
    <section className="home-spotlight">
      <div className="home-container">
        <div className="home-spotlight-card">
          {banner ? (
            link ? (
              <a
                className="home-spotlight-image-link"
                data-testid="spotlight-banner-link"
                {...link}
              >
                <BannerMedia
                  banner={banner}
                  className="home-spotlight-image"
                  width={1280}
                  height={720}
                />
              </a>
            ) : (
              <BannerMedia
                banner={banner}
                className="home-spotlight-image"
                width={1280}
                height={720}
              />
            )
          ) : (
            <img
              src={businessSpotlight}
              alt="ABC Auto Care workshop"
              width={1280}
              height={720}
              loading="lazy"
              className="home-spotlight-image"
            />
          )}
          <div className="home-spotlight-body">
            <p className="home-spotlight-tag">Business Spotlight · Advertisement</p>
            <h2>{banner?.title.trim() || "ABC Auto Care"}</h2>
            <p className="home-spotlight-text">Complete Car Service • AC • Denting • Painting</p>
            <p className="home-spotlight-place">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Indore
            </p>
            {banner && link ? (
              <a className="home-spotlight-link" {...link}>
                View details <ChevronRight className="h-4 w-4" />
              </a>
            ) : (
              <Link to="/services" className="home-spotlight-link">
                View details <ChevronRight className="h-4 w-4" />
              </Link>
            )}
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

/** Advertising strip under the homepage categories. Silent unless the slot is live. */
export function HomeTopAd() {
  return <BannerAd section="home_top" className="home-ad-top" />;
}

/** Tall ad under the BUY filters. Silent unless the slot is live. */
export function SidebarAd() {
  return <BannerAd section="sidebar" className="mw-ad-sidebar" label="Sponsored" />;
}

const FEATURED_COUNT = 2;

export function PopularVehicles() {
  const shortlist = useShortlist();
  const [offerId, setOfferId] = useState<string | null>(null);
  const offerListing = offerId ? (getBuyListing(offerId) ?? null) : null;

  return (
    <section className="home-showcase-main" aria-labelledby="popular-vehicles-title">
      <div className="home-section-heading">
        <div>
          <p className="home-section-kicker">Marketplace</p>
          <h2 id="popular-vehicles-title">
            Popular <span>Vehicles</span>
          </h2>
          <p>Featured picks and top listings from our marketplace</p>
        </div>
        <Link to="/buy" search={{ category: "cars" }}>
          View all <ArrowRight size={14} />
        </Link>
      </div>
      <div className="home-listing-grid">
        {LISTINGS.map(({ listing, image }, index) => {
          const name = `${listing.brand} ${listing.model}`;
          const shortlisted = shortlist.has(listing.id);
          const featured = index < FEATURED_COUNT;
          return (
            <article key={listing.id} className="home-listing-card">
              {/* The whole card opens the vehicle detail page; the buttons below
                  sit above this overlay so favourite and offer still work. */}
              <Link
                to="/buy/vehicle/$id"
                params={{ id: listing.id }}
                className="home-listing-hit"
                aria-label={`Open details for ${name}`}
              />
              <div className="home-listing-image">
                <img
                  src={image}
                  alt={`${name} ${listing.categoryLabel} illustrative demo photograph`}
                  width={720}
                  height={450}
                  loading="lazy"
                />
                {featured ? <span className="home-listing-featured">Featured</span> : null}
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
    </section>
  );
}

/**
 * Horizontal ad carousel for the homepage sidebar.
 *
 * Every Active banner that has artwork (except the tall sidebar slot, which is
 * rendered separately) becomes a snap-scrolling card. It is a plain overflow-x
 * rail, so touch scrolling keeps native momentum and the five ad slots stay in
 * one compact row instead of pushing the listing down.
 */
export function HomeAdCarousel() {
  const { banners } = useBanners();
  const ads = banners.filter(
    (banner) =>
      banner.status === "Active" && banner.imageUrl.trim() && banner.section !== "sidebar",
  );
  if (!ads.length) return null;

  return (
    <section className="home-side-carousel" aria-label="Sponsored highlights">
      <div className="home-side-carousel-head">
        <p>Sponsored</p>
        <span>Swipe for more</span>
      </div>
      <div className="home-side-carousel-rail">
        {ads.map((banner) => {
          const link = bannerLinkProps(banner);
          const media = (
            <BannerMedia
              banner={banner}
              className="home-side-carousel-media"
              width={640}
              height={360}
            />
          );
          const title = banner.title.trim();
          return (
            <article className="home-side-carousel-card" key={banner.id}>
              {link ? (
                <a className="home-side-carousel-link" {...link}>
                  {media}
                  {title ? <span className="home-side-carousel-title">{title}</span> : null}
                </a>
              ) : (
                <div className="home-side-carousel-link">
                  {media}
                  {title ? <span className="home-side-carousel-title">{title}</span> : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Desktop sticky sidebar.
 *
 * Image-first franchise card (hidden below desktop; the footer keeps the link
 * on mobile), the advertise CTA, a horizontal ad carousel and one tall ad.
 */
export function HomeSidebar() {
  const franchise = useActiveBanner("franchise_banner");

  return (
    <aside className="home-showcase-side" aria-label="Advertise and sponsored">
      <div className="home-side-stack">
        <section className="home-side-advertise">
          <p className="home-side-advertise-kicker">Advertise with us</p>
          <h2>Put your business in front of every buyer.</h2>
          <Button asChild className="home-cta home-cta-primary home-side-advertise-cta">
            <Link to="/contact">
              Advertise Your Business <ArrowRight size={15} />
            </Link>
          </Button>
        </section>

        <section className="home-side-franchise-card" aria-labelledby="home-side-franchise-title">
          <div className="home-side-franchise-media">
            {franchise ? (
              <BannerMedia
                banner={franchise}
                className="home-side-franchise-image"
                width={640}
                height={360}
              />
            ) : (
              <img
                src={franchiseShowroom}
                alt="Premium automotive franchise showroom"
                width={1280}
                height={720}
                loading="lazy"
                className="home-side-franchise-image"
              />
            )}
          </div>
          <div className="home-side-franchise-body">
            <p className="home-side-franchise-kicker">Franchise opportunity</p>
            <h2 id="home-side-franchise-title">
              Become a <span>Franchise Partner</span>
            </h2>
            <p className="home-side-franchise-text">
              Join Motor Wallah and grow your automotive business with us.
            </p>
            <Button asChild className="home-cta home-cta-primary home-side-franchise-cta">
              <Link to="/franchise">
                Apply Now <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
        </section>

        <HomeAdCarousel />

        <BannerAd
          section="sidebar"
          className="mw-ad-sidebar home-side-vertical-ad"
          label="Sponsored"
        />
      </div>
    </aside>
  );
}

/** Two-column desktop layout: vehicle grid left, sticky ad sidebar right. */
export function HomeShowcase() {
  return (
    <section className="home-showcase">
      <div className="home-container">
        <div className="home-showcase-grid">
          <PopularVehicles />
          <HomeSidebar />
        </div>
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
