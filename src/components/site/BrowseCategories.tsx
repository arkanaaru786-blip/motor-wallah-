import { useState } from "react";
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
import showroom from "@/assets/franchise-showroom.jpg";
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
const IMAGES: string[] = [cars, bikes, threeWheelers, miniTruck, trucks, buses, tractors, taxis];
const BRAND_LOGOS: Record<string, string> = {
  "Maruti Suzuki": maruti.url,
  Hyundai: hyundai.url,
  Tata: tata.url,
  "Tata Motors": tata.url,
  Toyota: toyota.url,
  Mahindra: mahindra.url,
  Honda: honda.url,
  Kia: kia.url,
  MG: mg.url,
  Renault: renault.url,
  Škoda: skoda.url,
  BMW: bmw.url,
  "Mercedes-Benz": mercedes.url,
  Bajaj: bajaj.url,
  TVS: tvs.url,
  Eicher: eicher.url,
  Force: force.url,
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

// Authentic manufacturer artwork served from the project's Lovable asset
// store; if a stored file is unavailable the brand name is shown instead of a
// broken image.
function BrandArt({
  src,
  label,
  width,
  height,
}: {
  src: string | undefined;
  label: string;
  width: number;
  height: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="home-logo-fallback">{label}</span>;
  return (
    <img
      src={src}
      alt={`${label} logo`}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function BrandStrip() {
  return (
    <nav aria-label="Featured vehicle brands" className="home-brand-rail">
      {[
        "Maruti Suzuki",
        "Hyundai",
        "Tata Motors",
        "Toyota",
        "Mahindra",
        "Honda",
        "Kia",
        "MG",
        "Renault",
        "Škoda",
        "BMW",
        "Mercedes-Benz",
      ].map((brand) => (
        <Link
          key={brand}
          to="/cars"
          search={{ brand: brand === "Tata Motors" ? "Tata" : brand }}
          className="home-brand-wordmark"
          aria-label={brand}
        >
          <BrandArt src={BRAND_LOGOS[brand]} label={brand} width={66} height={34} />
        </Link>
      ))}
      <Link to="/cars" className="home-brand-all">
        View all brands <ArrowRight size={14} />
      </Link>
    </nav>
  );
}

function ExploreSideCards() {
  return (
    <aside className="home-explore-side">
      <Link to="/franchise" className="home-side-card home-side-franchise">
        <p className="home-side-eyebrow">Become a</p>
        <h3>Franchise Partner</h3>
        <span className="home-side-text">
          Join Motor Wallah and grow your automotive business with us.
        </span>
        <span className="home-side-cta">
          Apply Now <ArrowRight size={14} />
        </span>
      </Link>

      <Link to="/about" className="home-side-card home-side-showroom">
        <img
          src={showroom}
          alt="Motor Wallah vehicle showroom"
          width={1280}
          height={720}
          loading="lazy"
        />
        <span className="home-side-showroom-body">
          <span className="home-side-showroom-text">
            Quality Vehicles.
            <br />
            Trusted Partners.
          </span>
          <span className="home-side-arrow" aria-hidden="true">
            <ArrowRight size={14} />
          </span>
        </span>
      </Link>
    </aside>
  );
}

export function BrowseCategories() {
  return (
    <section className="home-categories">
      <div className="home-container">
        <div className="home-explore-layout">
          <div className="home-explore-panel">
            <div className="home-section-heading">
              <div>
                <h2>
                  Explore <span>Vehicles</span>
                </h2>
                <p>Find your perfect ride from our wide range of vehicle categories.</p>
              </div>
              <Link to="/cars">
                View all categories <ArrowRight size={14} />
              </Link>
            </div>

            <div className="home-category-grid">
              {BUY_CATEGORIES.map((c, i) => {
                const image = IMAGES[i];
                return (
                  <Link key={c.to} to={c.to} className="home-category-card">
                    <span className="home-category-media">
                      {image ? (
                        <img
                          src={image}
                          alt={`${c.label} illustrative photograph`}
                          width={720}
                          height={450}
                          loading="lazy"
                        />
                      ) : (
                        <span className="home-image-placeholder">
                          <span>
                            {c.label}
                            <small>Photo coming soon</small>
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="home-category-body">
                      <span className="home-category-info">
                        <span className="home-category-name">{c.label}</span>
                        <span className="home-category-blurb">{c.blurb}</span>
                      </span>
                      <span className="home-category-arrow" aria-hidden="true">
                        <ChevronRight size={16} />
                      </span>
                    </span>
                    <span className="home-category-brands">
                      {CATEGORY_BRANDS[i]?.map((brand) => (
                        <span key={brand} className="home-category-wordmark">
                          {BRAND_LOGOS[brand] ? (
                            <BrandArt
                              src={BRAND_LOGOS[brand]}
                              label={brand}
                              width={52}
                              height={23}
                            />
                          ) : (
                            brand
                          )}
                        </span>
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <ExploreSideCards />
        </div>
      </div>
    </section>
  );
}
