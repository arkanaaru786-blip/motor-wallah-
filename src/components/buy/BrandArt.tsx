import { useState } from "react";
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
// Locally stored brand artwork (Wikimedia Commons / official brand marks).
import ford from "@/assets/brands/ford.svg";
import hero from "@/assets/brands/hero.svg";
import royalEnfield from "@/assets/brands/royal-enfield.svg";
import yamaha from "@/assets/brands/yamaha.svg";
import suzuki from "@/assets/brands/suzuki.svg";
import piaggio from "@/assets/brands/piaggio.svg";
import ola from "@/assets/brands/ola.svg";
import johnDeere from "@/assets/brands/john-deere.svg";
import newHolland from "@/assets/brands/new-holland.png";
import sonalika from "@/assets/brands/sonalika.png";
import masseyFerguson from "@/assets/brands/massey-ferguson.png";
import swaraj from "@/assets/brands/swaraj.png";
import bharatbenz from "@/assets/brands/bharatbenz.jpg";
import ashokLeyland from "@/assets/brands/ashok-leyland.jpg";
import atul from "@/assets/brands/atul.jpg";
import khalsaEv from "@/assets/brands/khalsa-ev.svg";
import allFineEv from "@/assets/brands/all-fine-ev.svg";

/**
 * Real manufacturer artwork already stored in the project. Category-specific
 * brand names (e.g. "Tata (SCV)") reuse the parent brand's genuine logo.
 * Anything without artwork falls back to a clean typographic wordmark.
 */
const LOGOS: Record<string, string> = {
  "Maruti Suzuki": maruti,
  "Maruti Suzuki (SCV)": maruti,
  "Maruti Suzuki (Taxi)": maruti,
  Hyundai: hyundai,
  "Hyundai (Taxi)": hyundai,
  Tata: tata,
  "Tata Motors": tata,
  "Tata (SCV)": tata,
  "Tata (Taxi)": tata,
  "Tata Buses": tata,
  Toyota: toyota,
  "Toyota (Taxi)": toyota,
  Mahindra: mahindra,
  "Mahindra (3W)": mahindra,
  "Mahindra (SCV)": mahindra,
  "Mahindra Trucks": mahindra,
  Honda: honda,
  Kia: kia,
  MG: mg,
  Renault: renault,
  Skoda: skoda,
  Škoda: skoda,
  BMW: bmw,
  "Mercedes-Benz": mercedes,
  Bajaj: bajaj,
  TVS: tvs,
  "TVS (3W)": tvs,
  Eicher: eicher,
  "Eicher Trucks": eicher,
  "Eicher Buses": eicher,
  Force: force,
  "Force Motors": force,
  Ford: ford,
  Hero: hero,
  "Royal Enfield": royalEnfield,
  Yamaha: yamaha,
  Suzuki: suzuki,
  Piaggio: piaggio,
  "Piaggio (SCV)": piaggio,
  "Ola Electric": ola,
  "John Deere": johnDeere,
  "New Holland": newHolland,
  Sonalika: sonalika,
  "Massey Ferguson": masseyFerguson,
  Swaraj: swaraj,
  BharatBenz: bharatbenz,
  "BharatBenz Buses": bharatbenz,
  "Ashok Leyland": ashokLeyland,
  "Ashok Leyland (SCV)": ashokLeyland,
  "Ashok Leyland Buses": ashokLeyland,
  Atul: atul,
  "Khalsa EV": khalsaEv,
  "All Fine EV": allFineEv,
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
