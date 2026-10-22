import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export function Locations() {
  return (
    <section className="bg-secondary/50 py-14">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <h2 className="section-title">
          Find Motor Wallah <span className="text-primary">Near You</span>
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-border bg-card p-6">
            <MapPin className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h3 className="mt-4 font-display text-xl font-bold uppercase">Indore</h3>
            <p className="mt-1 text-sm text-muted-foreground">Madhya Pradesh</p>
          </div>
        </div>

        <div className="mt-8">
          <Link
            to="/locations"
            className="inline-flex items-center gap-2 border border-border bg-card px-6 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
          >
            View Locations
          </Link>
        </div>
      </div>
    </section>
  );
}
