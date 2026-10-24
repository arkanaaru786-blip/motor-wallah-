import { ChevronRight, Cog, FileText, Landmark, ShieldCheck, Wrench } from "lucide-react";
import {
  BUY_CATEGORY_LIST,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import { BUY_SERVICE_CATEGORIES, type BuyServiceId } from "@/lib/buy-services";

const SERVICE_ICONS = {
  wrench: Wrench,
  cog: Cog,
  landmark: Landmark,
  shield: ShieldCheck,
  "file-text": FileText,
} as const;

/**
 * Page 1 of the BUY marketplace — the category hub.
 *
 * Vehicle cards follow the reference design: category image on top, bold name,
 * blurb and a chevron arrow. Picking any card moves the visitor into that
 * category's dynamic listing flow; nothing else on the hub is filtered first.
 */
export function BuyHub({
  onSelectCategory,
  onSelectService,
}: {
  onSelectCategory: (id: BuyCategoryId) => void;
  onSelectService: (id: BuyServiceId) => void;
}) {
  return (
    <>
      <section className="mw-hub" id="mw-hub" aria-labelledby="mw-hub-title">
        <div className="home-container">
          <div className="mw-hub-head">
            <p className="mw-hub-kicker">
              <span aria-hidden="true" /> Choose vehicle category
            </p>
            <h2 id="mw-hub-title" className="mw-hub-title">
              Explore <span>8 categories</span>
            </h2>
            <p className="mw-hub-text">
              Explore 8 categories, find your perfect ride — every card opens its own brand rail,
              filters and listings.
            </p>
          </div>

          <div className="mw-hub-grid">
            {BUY_CATEGORY_LIST.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className="mw-hub-card"
                aria-label={`Browse ${category.label} listings`}
              >
                <span className="mw-hub-media">
                  <img
                    src={category.image}
                    alt={`${category.label} illustrative vehicle photograph`}
                    width={720}
                    height={450}
                    loading="lazy"
                  />
                </span>
                <span className="mw-hub-body">
                  <span className="mw-hub-name">{category.label}</span>
                  <span className="mw-hub-blurb">{category.blurb}</span>
                </span>
                <span className="mw-hub-arrow" aria-hidden="true">
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mw-hub mw-hub--services" aria-labelledby="mw-hub-services-title">
        <div className="home-container">
          <div className="mw-hub-head">
            <p className="mw-hub-kicker">
              <span aria-hidden="true" /> Beyond vehicles
            </p>
            <h2 id="mw-hub-services-title" className="mw-hub-title">
              Parts, finance & <span>paperwork</span>
            </h2>
            <p className="mw-hub-text">
              Service categories use the same listing layout with their own filters — bank name,
              provider, service type or part category.
            </p>
          </div>

          <div className="mw-hub-grid mw-hub-grid--services">
            {BUY_SERVICE_CATEGORIES.map((service) => {
              const Icon = SERVICE_ICONS[service.icon];
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onSelectService(service.id)}
                  className="mw-hub-card mw-hub-card--service"
                  aria-label={`Browse ${service.label}`}
                >
                  <span className="mw-hub-media mw-hub-media--icon">
                    <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
                    <span className="mw-hub-count">Demo listings</span>
                  </span>
                  <span className="mw-hub-body">
                    <span className="mw-hub-name">{service.label}</span>
                    <span className="mw-hub-blurb">{service.blurb}</span>
                  </span>
                  <span className="mw-hub-arrow" aria-hidden="true">
                    <ChevronRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
