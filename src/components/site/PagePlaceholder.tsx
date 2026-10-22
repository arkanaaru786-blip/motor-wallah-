import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { PHONE_HREF, PHONE_DISPLAY, WHATSAPP } from "@/lib/site";

export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-background pb-14 md:pb-0">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-ink py-14 text-ink-foreground lg:py-20">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-foreground/80">
              {description}
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <div className="border border-border bg-card p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold">This page is coming soon</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                We are currently building this section. Meanwhile, our team in Indore, Madhya Pradesh
                is available to help you directly.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={PHONE_HREF}
                  className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-primary-foreground"
                >
                  Call {PHONE_DISPLAY}
                </a>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
                >
                  WhatsApp Us
                </a>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
