import { useState } from "react";
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

/**
 * Real manufacturer artwork already stored in the project. Category-specific
 * brand names (e.g. "Tata (SCV)") reuse the parent brand's genuine logo.
 * Anything without artwork falls back to a clean typographic wordmark.
 */
const LOGOS: Record<string, string> = {
  "Maruti Suzuki": maruti.url,
  "Maruti Suzuki (SCV)": maruti.url,
  "Maruti Suzuki (Taxi)": maruti.url,
  Hyundai: hyundai.url,
  "Hyundai (Taxi)": hyundai.url,
  Tata: tata.url,
  "Tata Motors": tata.url,
  "Tata (SCV)": tata.url,
  "Tata (Taxi)": tata.url,
  "Tata Buses": tata.url,
  Toyota: toyota.url,
  "Toyota (Taxi)": toyota.url,
  Mahindra: mahindra.url,
  "Mahindra (3W)": mahindra.url,
  "Mahindra (SCV)": mahindra.url,
  "Mahindra Trucks": mahindra.url,
  Honda: honda.url,
  Kia: kia.url,
  MG: mg.url,
  Renault: renault.url,
  Skoda: skoda.url,
  Škoda: skoda.url,
  BMW: bmw.url,
  "Mercedes-Benz": mercedes.url,
  Bajaj: bajaj.url,
  TVS: tvs.url,
  "TVS (3W)": tvs.url,
  Eicher: eicher.url,
  "Eicher Trucks": eicher.url,
  "Eicher Buses": eicher.url,
  Force: force.url,
  "Force Motors": force.url,
};

export const hasBrandLogo = (brand: string) => Boolean(LOGOS[brand]);

/**
 * Brand artwork with a graceful typographic fallback — a broken image is never
 * rendered. `onError` also covers stored assets that fail to resolve.
 */
export function BrandArt({
  brand,
  className = "buy-brand-logo",
}: {
  brand: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = LOGOS[brand];

  if (!src || failed) {
    return (
      <span className={`buy-brand-wordmark ${className}`} aria-hidden="true">
        {brand
          .replace(/\s*\(.*?\)\s*/g, "")
          .replace("Buses", "")
          .trim()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
