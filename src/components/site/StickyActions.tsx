import { Link } from "@tanstack/react-router";
import { Car, MessageCircle, Phone } from "lucide-react";
import { PHONE_HREF, WHATSAPP } from "@/lib/site";

export function StickyActions() {
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
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-ink-foreground/15 bg-ink text-ink-foreground md:hidden">
        <a href={PHONE_HREF} className="flex flex-col items-center gap-1 py-2.5 text-[0.6rem] font-bold uppercase tracking-wide">
          <Phone className="h-4 w-4 text-primary" /> Call
        </a>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 border-x border-ink-foreground/15 py-2.5 text-[0.6rem] font-bold uppercase tracking-wide"
        >
          <MessageCircle className="h-4 w-4 text-primary" /> WhatsApp
        </a>
        <Link to="/cars" className="flex flex-col items-center gap-1 py-2.5 text-[0.6rem] font-bold uppercase tracking-wide">
          <Car className="h-4 w-4 text-primary" /> Cars
        </Link>
      </div>
    </>
  );
}
