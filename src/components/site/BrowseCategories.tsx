import { Link } from "@tanstack/react-router";
import { BUY_CATEGORIES } from "@/lib/site";
import { ArrowRight, ChevronRight } from "lucide-react";
import cars from "@/assets/homepage/Car.png";
import bikes from "@/assets/homepage/Bike.png";
import threeWheelers from "@/assets/homepage/3 wheeler.png";
import miniTruck from "@/assets/homepage/SCV.png";
import trucks from "@/assets/homepage/Truck.png";
import buses from "@/assets/homepage/Bus.png";
import tractors from "@/assets/homepage/Tractor.png";
import taxis from "@/assets/homepage/Taxi.png";
import maruti from "@/assets/homepage/maruti.svg.asset.json";
import hyundai from "@/assets/homepage/hyundai.png.asset.json";
import tata from "@/assets/homepage/tata.png.asset.json";
import toyota from "@/assets/homepage/toyota.png.asset.json";
import mahindra from "@/assets/homepage/mahindra.webp.asset.json";
import honda from "@/assets/homepage/honda.png.asset.json";
import kia from "@/assets/homepage/kia.png.asset.json";
import mg from "@/assets/homepage/mg.png.asset.json";
import renault from "@/assets/homepage/renault.png.asset.json";
import skoda from "@/assets/homepage/skoda.png.asset.json";
import bmw from "@/assets/homepage/bmw.png.asset.json";
import mercedes from "@/assets/homepage/mercedes-benz.png.asset.json";
import bajaj from "@/assets/homepage/bajaj.gif.asset.json";
import tvs from "@/assets/homepage/tvs.svg.asset.json";
import eicher from "@/assets/homepage/eicher.png.asset.json";
import force from "@/assets/homepage/force-motors.png.asset.json";

// Only independent scene photographs; unavailable categories stay replaceable.
const IMAGES: string[] = [
  Cars,
  Bikes,
  3Wheelers,
  SCV,
  Trucks,
  Buses,
  Tractors,
  Taxis,
];
const BRAND_LOGOS: Record<string, string> = {
  "Maruti Suzuki": maruti.url, Hyundai: hyundai.url, Tata: tata.url,
  "Tata Motors": tata.url, Toyota: toyota.url, Mahindra: mahindra.url,
  Honda: honda.url, Kia: kia.url, MG: mg.url, Renault: renault.url,
  "Škoda": skoda.url, BMW: bmw.url, "Mercedes-Benz": mercedes.url,
  Bajaj: bajaj.url, TVS: tvs.url, Eicher: eicher.url, Force: force.url,
};
const CATEGORY_BRANDS = [
  ["Maruti Suzuki", "Hyundai", "Tata", "Toyota"],
  ["Royal Enfield", "Bajaj", "TVS", "Honda"],
  ["Bajaj", "Piaggio", "TVS", "Mahindra"],
  ["Tata", "Ashok Leyland", "Mahindra"],
  ["Tata", "Ashok Leyland", "Eicher"],
  ["Tata", "Ashok Leyland", "Force"],
  ["Mahindra", "Sonalika", "Swaraj"],
  ["Maruti Suzuki", "Toyota", "Hyundai"],
];

// Authentic manufacturer artwork; text remains only where no logo is available.
export function BrandStrip() {
  return (
    <nav aria-label="Featured vehicle brands" className="home-brand-rail">
      {["Maruti Suzuki", "Hyundai", "Tata Motors", "Toyota", "Mahindra", "Honda", "Kia", "MG", "Renault", "Škoda", "BMW", "Mercedes-Benz"].map((brand) => (
        <Link key={brand} to="/cars" search={{ brand: brand === "Tata Motors" ? "Tata" : brand }} className="home-brand-wordmark" aria-label={brand}><img src={BRAND_LOGOS[brand]} alt={`${brand} logo`} width={66} height={34} loading="lazy" /></Link>
      ))}
      <Link to="/cars" className="home-brand-all">View all brands <ArrowRight size={14} /></Link>
    </nav>
  );
}

export function BrowseCategories() {
  return (
    <section className="home-categories bg-background">
      <div className="home-container">
        <div className="home-section-heading"><div><h2>Explore <span>Vehicles</span></h2><p>Find your perfect ride from our wide range of vehicles.</p></div><Link to="/cars">View all <ArrowRight size={14} /></Link></div>
        <div className="home-category-grid">
          {BUY_CATEGORIES.map((c, i) => {
            const image = IMAGES[i];
            return (
              <Link
                key={c.to}
                to={c.to}
                className="home-category-card group"
              >
                <div className="home-category-image">{image ? <img src={image} alt={`${c.label} illustrative photograph`} width={720} height={450} loading="lazy" /> : <span className="home-image-placeholder"><span>{c.label}<small>Photo coming soon</small></span></span>}</div>
                <div className="home-category-content"><span className="home-category-name">{c.label}<ChevronRight size={16} /></span>
                  <span className="home-category-brands">{CATEGORY_BRANDS[i]?.map((brand) => <span key={brand} className="home-category-wordmark">{BRAND_LOGOS[brand] ? <img src={BRAND_LOGOS[brand]} alt={`${brand} logo`} width={52} height={23} loading="lazy" /> : brand}</span>)}</span>
                  <span className="home-explore-link">Explore <ArrowRight size={12} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
