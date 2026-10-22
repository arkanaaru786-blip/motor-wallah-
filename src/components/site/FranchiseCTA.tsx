import { Link } from "@tanstack/react-router";
import { Handshake } from "lucide-react";

export function FranchiseCTA() {
  return (
    <section className="bg-background py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="border-l-4 border-primary bg-ink px-6 py-10 text-ink-foreground sm:px-10">
          <Handshake className="h-9 w-9 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 max-w-3xl font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">
            Build Your Automotive Business with <span className="text-primary">Motor Wallah</span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-foreground/80">
            Join the MOTOR WALLAH certified pre-owned car network with structured processes,
            operational support, marketing assistance, training and technology-driven systems.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/franchise/apply"
              className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Become a Franchise Partner
            </Link>
            <Link
              to="/franchise"
              className="inline-flex items-center gap-2 border border-ink-foreground/35 px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
            >
              Download Franchise Brochure
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
