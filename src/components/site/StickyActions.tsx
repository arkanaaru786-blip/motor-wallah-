import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bike,
  Bus,
  Car,
  CarFront,
  CarTaxiFront,
  Container,
  LayoutGrid,
  MessageCircle,
  Phone,
  Tractor,
  Truck,
  X,
  ArrowRight,
} from "lucide-react";
import { BUY_CATEGORIES, PHONE_HREF, WHATSAPP } from "@/lib/site";

/** One icon per BUY category, in the same order as BUY_CATEGORIES. */
const CATEGORY_ICONS = {
  cars: Car,
  bikes: Bike,
  "three-wheelers": CarTaxiFront,
  scv: Truck,
  trucks: Container,
  buses: Bus,
  tractors: Tractor,
  taxi: CarFront,
} as const;

/**
 * Mobile sticky bar: Call, WhatsApp and a Categories sheet with all eight
 * vehicle categories. The desktop floating buttons are unchanged.
 */
export function StickyActions() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Any navigation means the sheet has done its job.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop floating actions */}
      <div className="fixed bottom-6 right-6 z-50 hidden flex-col gap-3 md:flex">
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp us"
          className="grid h-12 w-12 place-items-center rounded-full bg-ink text-ink-foreground shadow-panel transition-transform hover:-translate-y-0.5 hover:text-primary"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
        <a
          href={PHONE_HREF}
          aria-label="Call now"
          className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-red transition-transform hover:-translate-y-0.5"
        >
          <Phone className="h-5 w-5" />
        </a>
      </div>

      {/* Mobile sticky bar */}
      <div className="mw-sticky-bar fixed inset-x-0 bottom-0 z-50 md:hidden">
        <a href={PHONE_HREF}>
          <Phone className="h-4 w-4 text-primary" aria-hidden="true" /> Call
        </a>
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" /> WhatsApp
        </a>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" /> Categories
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="mw-sheet-backdrop md:hidden"
            aria-label="Close categories"
            onClick={() => setOpen(false)}
          />
          <div
            className="mw-cat-sheet md:hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mw-cat-sheet-title"
          >
            <span className="mw-cat-sheet-grip" aria-hidden="true" />
            <div className="mw-cat-sheet-head">
              <div>
                <h2 id="mw-cat-sheet-title">Shop by category</h2>
                <p>All eight vehicle categories on Motor Wallah.</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="mw-cat-sheet-close"
                aria-label="Close categories"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mw-cat-grid">
              {BUY_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.category];
                return (
                  <Link
                    key={category.category}
                    to="/buy"
                    search={{ category: category.category }}
                    className="mw-cat-tile"
                  >
                    <span className="mw-cat-tile-icon">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="mw-cat-tile-label">{category.label}</span>
                      <span className="mw-cat-tile-blurb">{category.blurb}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link to="/buy" className="mw-cat-sheet-all">
              Browse every listing <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}
