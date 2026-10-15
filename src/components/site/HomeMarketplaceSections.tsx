import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, BadgeCheck, Building2, Calculator, ChevronRight, FileCheck2, GitCompareArrows, Handshake, IndianRupee, MapPin, Recycle, ShieldCheck, ShoppingBag, Store, Umbrella, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VEHICLES, formatPrice, formatKm } from "@/lib/cars-data";
import { CATEGORIES, CATEGORY_LISTINGS } from "@/lib/vehicle-categories";
import franchiseShowroom from "@/assets/franchise-showroom.jpg";
import businessSpotlight from "@/assets/business-spotlight.jpg";
import carPhoto from "@/assets/homepage/Car.png";
import bikePhoto from "@/assets/homepage/Bike.png";
import threeWheelPhoto from "@/assets/homepage/3 wheeler.png";
import miniTruckPhoto from "@/assets/homepage/SCV.png";
import truckPhoto from "@/assets/homepage/Truck.png";
import busPhoto from "@/assets/homepage/Bus.png";
import tractorPhoto from "@/assets/homepage/Tractor.png";
import taxiPhoto from "@/assets/homepage/Taxi.png";

// Presentation-only imagery: do not substitute unrelated models for demo listings.
const CATEGORY_IMAGES: string[] = [
  Carphoto 
  BikePhoto,
  3WheelPhoto,
  SCVPhoto,
  TruckPhoto,
  BusPhoto,
  TractorPhoto,
  TaxiPhoto,
];
const car = VEHICLES.find((vehicle) => vehicle.status === "Available");
const LISTINGS = [
  ...(car ? [{ name: `${car.make} ${car.model}`, variant: car.variant, year: car.year, fuel: car.fuel, km: formatKm(car.kilometres), place: car.location, price: formatPrice(car.price), image: carPhoto, to: "/cars/$id", slug: car.slug, badge: "Demo listing" }] : []),
  ...CATEGORIES.flatMap((category, index) => {
    const listing = CATEGORY_LISTINGS.find((item) => item.category === category.id);
    return listing ? [{ name: `${listing.brand.replace(/\s*\([^)]*\)/g, "")} ${listing.model}`, variant: category.title, year: listing.year, fuel: listing.fuel, km: formatKm(listing.kilometres), place: listing.location, price: formatPrice(listing.price), image: CATEGORY_IMAGES[index], to: category.to, slug: undefined, badge: "Demo listing" }] : [];
  }),
];

const ACTIONS = [
  { label: "Buy", to: "/cars", icon: ShoppingBag, text: "Find your next ride" }, { label: "Sell", to: "/sell-your-car", icon: Store, text: "Get the best value" }, { label: "Exchange", to: "/exchange", icon: ArrowLeftRight, text: "Upgrade easily" },
  { label: "Value", to: "/sell-your-car", icon: Calculator, text: "Know your worth" }, { label: "Compare", to: "/cars", icon: GitCompareArrows, text: "Make the right choice" }, { label: "Service", to: "/services", icon: Wrench, text: "Keep it running" }, { label: "Scrap", to: "/contact", icon: Recycle, text: "Turn old into value" },
] as const;

const TRUST = [
  { icon: BadgeCheck, title: "Verified Vehicles", text: "Carefully verified for quality and ownership." },
  { icon: FileCheck2, title: "Transparent Information", text: "Clear vehicle details and available records." },
  { icon: ShieldCheck, title: "Inspection & Certification", text: "Multi-point inspection and certification." },
  { icon: Handshake, title: "Trusted Partners", text: "Automotive network across the marketplace." },
  { icon: IndianRupee, title: "Finance Assistance", text: "Support through relevant lending partners." },
  { icon: Umbrella, title: "Insurance Assistance", text: "Insurance support through relevant providers." },
] as const;

export function FranchiseBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "home-franchise home-franchise-lower" : "home-franchise"}>
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className={`relative isolate overflow-hidden rounded-sm bg-ink text-ink-foreground ${compact ? "min-h-40" : "min-h-52 sm:min-h-64"}`}>
          <img src={franchiseShowroom} alt="Premium automotive franchise showroom" width={1920} height={720} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/5" />
          <div className="relative flex min-h-inherit max-w-xl flex-col items-start justify-center px-6 py-8 sm:px-10">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary">Franchise opportunity</p>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight sm:text-4xl">Build Your Automotive Business<br /><span className="text-primary">With Motor Wallah</span></h2>
            {!compact && <p className="mt-3 max-w-md text-sm text-ink-foreground/75">Start your automotive business with the MOTOR WALLAH franchise network.</p>}
            <Button asChild className="mt-5 rounded-sm text-xs font-bold uppercase"><Link to="/franchise">Become a Franchise Partner</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BusinessSpotlight() {
  return (
    <section className="home-spotlight">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="grid overflow-hidden rounded-sm border border-border bg-card shadow-sm sm:grid-cols-[15rem_minmax(0,1fr)_auto] sm:items-center">
          <img src={businessSpotlight} alt="ABC Auto Care workshop" width={1280} height={720} loading="lazy" className="h-40 w-full object-cover sm:h-full" />
          <div className="min-w-0 p-5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">Business Spotlight · Advertisement</p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase">ABC Auto Care</h2>
            <p className="mt-1 text-sm text-muted-foreground">Complete Car Service • AC • Denting • Painting</p>
            <p className="mt-2 flex items-center gap-1 text-xs"><MapPin className="h-3.5 w-3.5 text-primary" /> Indore</p>
            <Link to="/services" className="mt-3 inline-flex items-center text-xs font-bold uppercase text-primary">View details <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="border-t border-border p-5 sm:border-l sm:border-t-0">
            <Button asChild variant="outline" className="w-full rounded-sm border-primary text-xs font-bold uppercase text-primary"><Link to="/contact"><Building2 /> Advertise Your Business</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PopularVehicles() {
  return (
    <section className="home-popular bg-background">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="home-section-heading"><div><h2>Popular <span>Vehicles</span></h2><p>Top picks from our marketplace · Demo listings</p></div><Link to="/cars">View all <ArrowRight size={14} /></Link></div>
        <div className="home-listing-grid">
          {LISTINGS.map((item) => (
            <article key={item.name} className="home-listing-card flex min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-card shadow-sm">
              <div className={`home-listing-image ${item.slug ? "" : "home-category-preview"}`}>{item.image ? <img src={item.image} alt={`${item.name} illustrative demo photograph`} width={720} height={450} loading="lazy" /> : <span className="home-image-placeholder"><span>Vehicle photo<small>Coming soon</small></span></span>}<span className="home-demo-badge">{item.badge}</span></div>
              <div className="flex flex-1 flex-col p-3">
                <p className="truncate text-[0.55rem] font-bold uppercase text-primary">{item.name.split(" ")[0]}</p>
                <h3 className="mt-0.5 min-h-9 text-xs font-bold leading-tight normal-case">{item.name}</h3>
                <p className="mt-1 truncate text-[0.62rem] text-muted-foreground">{item.variant}</p>
                <p className="mt-2 text-[0.6rem] text-muted-foreground">{item.year} · {item.fuel}</p>
                <p className="mt-1 text-[0.6rem] text-muted-foreground">{item.km} · {item.place}</p>
                <p className="mt-2 font-display text-base font-bold text-primary">{item.price}</p>
                <Button asChild size="sm" className="home-listing-button mt-auto">{item.slug ? <Link to="/cars/$id" params={{ id: item.slug }}>View Details <ArrowRight size={12} /></Link> : <Link to={item.to}>View Details <ArrowRight size={12} /></Link>}</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketplaceActions() {
  return (
    <section className="home-action-section">
      <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
        <div className="home-action-intro"><h2>What Do You Want To Do?</h2><p>Quick actions for your automotive journey</p></div>
        <div className="home-action-options">
          {ACTIONS.map(({ icon: Icon, ...item }) => <Link key={item.label} to={item.to}><Icon size={23} /><span><strong>{item.label}</strong><small>{item.text}</small></span></Link>)}
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="home-trust bg-background">
      <div className="mx-auto max-w-[1400px] px-4 lg:px-8">
        <div className="home-section-heading"><div><h2>Why Motor <span>Wallah</span></h2><p>More than just a marketplace — we build trust.</p></div></div>
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-6">
          {TRUST.map(({ icon: Icon, title, text }) => <div key={title} className="text-center"><Icon className="mx-auto h-7 w-7 text-primary" strokeWidth={1.5} /><h3 className="mt-3 text-xs font-bold uppercase">{title}</h3><p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">{text}</p></div>)}
        </div>
      </div>
    </section>
  );
}