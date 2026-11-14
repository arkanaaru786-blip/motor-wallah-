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
import maruti from "@/assets/brands/maruti.svg";
import hyundai from "@/assets/brands/hyundai.png";
import tata from "@/assets/brands/tata.png";
import toyota from "@/assets/brands/toyota.png";
import mahindra from "@/assets/brands/mahindra.webp";
import honda from "@/assets/brands/honda.png";
import kia from "@/assets/brands/kia.png";
import mg from "@/assets/brands/mg.png";
import renault from "@/assets/brands/renault.png";
import skoda from "@/assets/brands/skoda.png";
import bmw from "@/assets/brands/bmw.png";
import mercedes from "@/assets/brands/mercedes-benz.png";
import bajaj from "@/assets/brands/bajaj.gif";
import tvs from "@/assets/brands/tvs.svg";
import eicher from "@/assets/brands/eicher.png";
import force from "@/assets/brands/force-motors.png";

// Only independent scene photographs; unavailable categories stay replaceable.
const IMAGES: string[] = [cars, bikes, threeWheelers, miniTruck, trucks, buses, tractors, taxis];
const BRAND_LOGOS: Record<string, string> = {
  "Maruti Suzuki": maruti,
  Hyundai: hyundai,
  Tata: tata,
  "Tata Motors": tata,
  Toyota: toyota,
  Mahindra: mahindra,
  Honda: honda,
  Kia: kia,
  MG: mg,
  Renault: renault,
  Škoda: skoda,
  BMW: bmw,
  "Mercedes-Benz": mercedes,
  Bajaj: bajaj,
  TVS: tvs,
  Eicher: eicher,
  Force: force,
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
          to="/buy"
          search={{ category: "cars" }}
          className="home-brand-wordmark"
          aria-label={`Browse ${brand} cars`}
        >
          <BrandArt src={BRAND_LOGOS[brand]} label={brand} width={66} height={34} />
        </Link>
      ))}
      <Link to="/buy" search={{ category: "cars" }} className="home-brand-all">
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
              <Link to="/buy">
                View all categories <ArrowRight size={14} />
              </Link>
            </div>

            <div className="home-category-grid">
              {BUY_CATEGORIES.map((c, i) => {
                const image = IMAGES[i];
                return (
                  <Link
                    key={c.category}
                    to="/buy"
                    search={{ category: c.category }}
                    className="home-category-card"
                  >
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
