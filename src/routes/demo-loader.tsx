import { useEffect, type CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import carImg from "@/assets/homepage/Car.png";
import bikeImg from "@/assets/homepage/Bike.png";
import threeWheelerImg from "@/assets/homepage/3 wheeler.png";
import scvImg from "@/assets/homepage/SCV.png";
import truckImg from "@/assets/homepage/Truck.png";
import busImg from "@/assets/homepage/Bus.png";
import tractorImg from "@/assets/homepage/Tractor.png";
import taxiImg from "@/assets/homepage/Taxi.png";
import "@/styles/demo-loader.css";

/**
 * Standalone preview of the page-transition loader: glass overlay, pulsing
 * shield core and eight vehicle categories orbiting on a CSS-only carousel.
 * Nothing here is wired into the live site — the route exists for review only.
 */
const CATEGORIES = [
  { label: "Cars", image: carImg },
  { label: "Bikes", image: bikeImg },
  { label: "3-Wheelers", image: threeWheelerImg },
  { label: "SCV", image: scvImg },
  { label: "Trucks", image: truckImg },
  { label: "Buses", image: busImg },
  { label: "Tractors", image: tractorImg },
  { label: "Taxi", image: taxiImg },
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
  // Hide the site's consent banner while the demo overlay is open, so the
  // overlay can be reviewed on its own. Scoped to this route and reverted on exit.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("mw-demo-open");
    return () => root.classList.remove("mw-demo-open");
  }, []);

  return (
    <div className="mw-demo-page">
      <div className="mw-demo-page__hint">
        <span className="mw-demo-page__tag">
          <Sparkles size={14} aria-hidden="true" /> Page transition preview
        </span>
        <p className="mw-demo-page__copy">
          Glass overlay · pulsing shield · eight categories orbiting on a pure CSS carousel.
        </p>
      </div>

      <div className="mw-demo-overlay" role="dialog" aria-label="Loading Motor Wallah" aria-busy="true">
        <div className="mw-demo-shell">
          <div className="mw-demo-ring" aria-hidden="true">
            {CATEGORIES.map((category, index) => (
              <div
                key={category.label}
                className="mw-demo-item"
                style={{ "--i": index } as CSSProperties}
              >
                <span className="mw-demo-item__frame">
                  <img
                    src={category.image}
                    alt=""
                    className="mw-demo-item__img"
                    width={180}
                    height={180}
                    decoding="async"
                  />
                </span>
                <span className="mw-demo-item__label">{category.label}</span>
              </div>
            ))}
          </div>

          <div className="mw-demo-core">
            <img src="/icon.svg" alt="Motor Wallah" width={256} height={256} />
          </div>

          <p className="mw-demo-caption" aria-live="polite">
            <ShieldCheck size={13} aria-hidden="true" /> Loading your marketplace…
          </p>
        </div>

        <Link to="/" className="mw-demo-close">
          <ArrowLeft size={15} aria-hidden="true" /> Close Demo
        </Link>
      </div>
    </div>
  );
}
