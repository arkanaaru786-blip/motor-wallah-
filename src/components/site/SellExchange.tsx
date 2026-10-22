import { Link } from "@tanstack/react-router";
import { MessageCircle, Phone, Repeat, TrendingUp } from "lucide-react";
import { PHONE_HREF, whatsappLink } from "@/lib/site";

const SELL_WA = whatsappLink("Hi Motor Wallah, I want a valuation for my car.");

export function SellExchange() {
  return (
    <section id="sell" className="bg-background py-14">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 lg:grid-cols-2 lg:px-8">
        <div className="border border-border bg-card p-6 sm:p-7">
          <TrendingUp className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-2xl font-bold uppercase leading-tight">
            Sell Your Car <span className="text-primary">at the Right Price</span>
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Get a transparent vehicle evaluation and a hassle-free selling experience with MOTOR
            WALLAH.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/sell-your-car"
              className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Get Car Value
            </Link>
            <a
              href={SELL_WA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Us
            </a>
            <a
              href={PHONE_HREF}
              className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
            >
              <Phone className="h-4 w-4" /> Call Now
            </a>
          </div>
        </div>

        <div className="border border-border bg-card p-6 sm:p-7">
          <Repeat className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-2xl font-bold uppercase leading-tight">
            Upgrade with <span className="text-primary">Easy Exchange</span>
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Share your current car details and explore an easier way to upgrade to your next
            certified pre-owned car.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/exchange"
              className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Start Exchange
            </Link>
            <Link
              to="/exchange"
              className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
            >
              Get Exchange Value
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
