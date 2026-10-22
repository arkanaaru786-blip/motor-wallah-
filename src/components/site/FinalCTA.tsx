import { Link } from "@tanstack/react-router";

export function FinalCTA() {
  return (
    <section className="bg-ink py-14 text-ink-foreground">
      <div className="mx-auto max-w-[1600px] px-4 text-center lg:px-8">
        <h2 className="font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">
          Ready to Drive with <span className="text-primary">Confidence?</span>
        </h2>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/cars"
            className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            View Cars
          </Link>
          <Link
            to="/sell-your-car"
            className="inline-flex items-center justify-center gap-2 border border-ink-foreground/35 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
          >
            Sell Your Car
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 border border-ink-foreground/35 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
