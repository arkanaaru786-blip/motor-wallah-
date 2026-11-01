import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  IndianRupee,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import marketplaceHero from "@/assets/marketplace-hero.jpg";
import { Button } from "@/components/ui/button";
import { BrandStrip } from "@/components/site/BrowseCategories";
import { SmartSearch } from "@/components/site/SmartSearch";

const TRUST_CHIPS = [
  { icon: BadgeCheck, label: "Verified Vehicles" },
  { icon: FileCheck2, label: "Transparent Information" },
  { icon: ShieldCheck, label: "Inspection & Certification" },
  { icon: IndianRupee, label: "Finance Assistance" },
] as const;

export function Hero() {
  return (
    <section className="home-hero-shell">
      <div className="home-hero relative isolate overflow-hidden">
        <img
          src={marketplaceHero}
          alt="Car, bike, 3-wheeler, small commercial vehicle, truck, bus and tractor in the Motor Wallah marketplace"
          width={1920}
          height={1024}
          fetchPriority="high"
          className="home-hero-image"
        />
        <div className="home-hero-shade" />

        <div className="home-container home-hero-content">
          <div className="home-hero-copy">
            <p className="home-hero-eyebrow">Drive Trust. Drive Quality.</p>
            <h1>
              Every Vehicle.
              <span className="block text-primary">One Marketplace.</span>
            </h1>{" "}
            <p className="home-hero-sub">
              Buy, sell and service cars, bikes, 3-wheelers, commercial vehicles and tractors — all
              in one place.
            </p>
            <p className="home-hero-pipes">
              Buy | Sell | Exchange | Finance | Insurance | Service | Scrap | Franchise
            </p>
            <div className="home-hero-cta">
              <Button asChild size="lg" className="home-cta home-cta-primary">
                <Link to="/buy">
                  Buy Vehicles <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="home-cta home-cta-ghost">
                <Link to="/sell-your-car">
                  Sell Vehicle <Store size={16} />
                </Link>
              </Button>
            </div>
            <SmartSearch placeholder="Search by brand, model, part or decor" />
            <ul className="home-hero-trust">
              {TRUST_CHIPS.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon size={14} strokeWidth={2} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="home-hero-badge" aria-hidden="true">
            <ShoppingBag size={18} />
            <p>
              <strong>Every Vehicle.</strong>
              <span>One Marketplace.</span>
            </p>
          </aside>
        </div>
      </div>
      <div className="home-container">
        <BrandStrip />
      </div>
    </section>
  );
}
