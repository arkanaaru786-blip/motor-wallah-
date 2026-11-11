import { useEffect, type CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import carImg from "@/assets/demo-loader/car.png";
import bikeImg from "@/assets/demo-loader/bike.png";
import autoImg from "@/assets/demo-loader/auto.png";
import truckImg from "@/assets/demo-loader/truck.png";
import busImg from "@/assets/demo-loader/bus.png";
import tractorImg from "@/assets/demo-loader/tractor.png";
import taxiImg from "@/assets/demo-loader/taxi.png";
import scvImg from "@/assets/demo-loader/scv.png";
import "@/styles/demo-loader.css";

/**
 * Standalone preview of the premium page-transition loader: heavy glass overlay,
 * a large pulsing shield at the centre and eight raw transparent vehicle images
 * orbiting on a CSS-only rotation. Nothing here is wired into the live site.
 */
const VEHICLES = [
  { label: "Car", image: carImg },
  { label: "Bike", image: bikeImg },
  { label: "Auto", image: autoImg },
  { label: "Truck", image: truckImg },
  { label: "Bus", image: busImg },
  { label: "Tractor", image: tractorImg },
  { label: "Taxi", image: taxiImg },
  { label: "SCV", image: scvImg },
];

export const Route = createFileRoute("/demo-loader")({
  head: () => ({
    meta: [
      { title: "Loader Demo | Motor Wallah" },
      {
        name: "description",
        content: "Preview of the Motor Wallah page-transition loading screen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoLoaderPage,
});

function DemoLoaderPage() {
  // Hide the site's consent banner while the demo overlay is open so the loader
  // can be reviewed on its own. Scoped to this route and reverted on exit.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("mw-demo-open");
    return () => root.classList.remove("mw-demo-open");
  }, []);

  return (
    <div className="mw-loader-page">
      <div className="mw-loader-page__aura" aria-hidden="true" />

      <div
        className="mw-loader"
        role="status"
        aria-live="polite"
        aria-label="Loading your marketplace"
      >
        <div className="mw-loader__stage">
          <div className="mw-loader__orbit" aria-hidden="true">
            {VEHICLES.map((vehicle, index) => (
              <span
                key={vehicle.label}
                className="mw-loader__slot"
                style={{ "--i": index } as CSSProperties}
              >
                <img
                  src={vehicle.image}
                  alt=""
                  width={320}
                  height={320}
                  decoding="async"
                  draggable={false}
                />
              </span>
            ))}
          </div>

          <div className="mw-loader__core">
            <span className="mw-loader__halo" aria-hidden="true" />
            <img src="/icon.svg" alt="Motor Wallah" width={256} height={256} />
          </div>
        </div>

        <div className="mw-loader__footer">
          <p className="mw-loader__caption">Loading your marketplace...</p>
          <span className="mw-loader__track" aria-hidden="true">
            <span className="mw-loader__pulse" />
          </span>
          <Link to="/" className="mw-loader__close">
            <ArrowLeft size={15} aria-hidden="true" /> Close Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
