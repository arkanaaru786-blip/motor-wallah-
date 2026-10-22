import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, X } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { readLeadQueue, type Lead } from "@/lib/leads";
import { isImage, type UploadedFile } from "@/lib/uploads";
import { formatINR } from "@/lib/valuation";

const TITLE = "Evaluation Enquiries | Motor Wallah Internal";
const DESCRIPTION =
  "Internal Motor Wallah evaluation view: customer details, vehicle details, photos and documents for each sell enquiry.";

export const Route = createFileRoute("/internal/evaluations")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-border pt-4">
    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary">{title}</p>
    <div className="mt-2">{children}</div>
  </div>
);

const DocRow = ({ d, onOpen }: { d: UploadedFile; onOpen: (f: UploadedFile) => void }) => (
  <li className="flex items-center gap-2 text-xs">
    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="font-semibold uppercase tracking-wide">{d.label}</span>
    <button type="button" onClick={() => onOpen(d)} className="text-muted-foreground hover:text-primary">
      View
    </button>
    <a
      href={d.dataUrl}
      download={d.name}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
    >
      <Download className="h-3.5 w-3.5" /> Download
    </a>
  </li>
);

function Page() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState<UploadedFile | null>(null);

  useEffect(() => {
    setLeads(readLeadQueue().filter((l) => l.type === "sell_car" && l.fields).reverse());
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-ink py-10 text-ink-foreground">
          <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
            <h1 className="font-display text-2xl font-bold uppercase sm:text-3xl">
              Evaluation <span className="text-primary">Enquiries</span>
            </h1>
            <p className="mt-2 text-xs text-ink-foreground/70">
              Internal view — customer details, vehicle details, market estimate, photos and documents.
            </p>
          </div>
        </section>

        <section className="py-10">
          <div className="mx-auto grid max-w-[1200px] gap-5 px-4 lg:px-8">
            {leads.length === 0 && (
              <p className="text-sm text-muted-foreground">No evaluation enquiries yet.</p>
            )}
            {leads.map((l) => {
              const f = l.fields ?? {};
              const docs = l.documents ?? [];
              const insurance = docs.find((d) => d.label === "Insurance Policy");
              const rc = docs.find((d) => d.label === "RC");
              const others = docs.filter((d) => d !== rc && d !== insurance);
              return (
                <article key={l.createdAt} className="grid gap-4 border border-border bg-card p-5">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-primary">
                      Customer Details
                    </p>
                    <p className="mt-1 font-display text-lg uppercase">{f["name"] ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[f["mobile"], f["whatsapp"], f["email"], f["city"]].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                      Received {new Date(l.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>

                  <Section title="Vehicle Details">
                    <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(f)
                        .filter(([k]) => !["name", "mobile", "whatsapp", "email", "city"].includes(k))
                        .map(([k, v]) => (
                          <p key={k}>
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-semibold">{v}</span>
                          </p>
                        ))}
                    </div>
                  </Section>

                  <Section title="Estimated Market Value">
                    {l.estimate ? (
                      <>
                        <p className="font-display text-xl uppercase">
                          {formatINR(l.estimate.low)} – {formatINR(l.estimate.high)}
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          Indicative estimate · confidence: {l.estimate.confidence}
                        </p>
                        {l.estimate.notes.map((n) => (
                          <p key={n} className="text-[0.7rem] text-muted-foreground">
                            • {n}
                          </p>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not generated.</p>
                    )}
                  </Section>

                  <Section title="Expectation Gap">
                    {l.expectation ? (
                      <div className="space-y-0.5 text-xs">
                        <p>Expected Price: <span className="font-semibold">{formatINR(l.expectation.expectedPrice)}</span></p>
                        <p>AI Midpoint: <span className="font-semibold">{formatINR(l.expectation.aiMidpoint)}</span></p>
                        <p>Gap: <span className="font-semibold">{formatINR(l.expectation.gap)} ({l.expectation.gapPercent}%)</span></p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No expected price given.</p>
                    )}
                  </Section>

                  <Section title="Vehicle Photos">
                    {l.photos?.length ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                        {l.photos.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setOpen(p)}
                            className="border border-border"
                            title={p.label}
                          >
                            <img src={p.dataUrl} alt={p.label} className="aspect-[4/3] w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No photos uploaded.</p>
                    )}
                  </Section>

                  <Section title="RC Document">
                    {rc ? (
                      <ul className="space-y-1">
                        <DocRow d={rc} onOpen={setOpen} />
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not uploaded.</p>
                    )}
                  </Section>

                  <Section title="Insurance Document">
                    {insurance ? (
                      <ul className="space-y-1">
                        <DocRow d={insurance} onOpen={setOpen} />
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not provided — document verification required before the final offer.
                      </p>
                    )}
                  </Section>

                  <Section title="Other Documents">
                    {others.length ? (
                      <ul className="space-y-1">
                        {others.map((d) => (
                          <DocRow key={d.id} d={d} onOpen={setOpen} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">None uploaded.</p>
                    )}
                  </Section>

                  <Section title="Inspection / Final Offer">
                    <p className="text-xs text-muted-foreground">
                      Pending internal inspection and final purchase offer.
                    </p>
                  </Section>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />

      {open && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/95 p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 text-ink-foreground"
          >
            <X className="h-6 w-6" />
          </button>
          {isImage(open) ? (
            <img src={open.dataUrl} alt={open.label} className="max-h-[85vh] max-w-full object-contain" />
          ) : (
            <iframe title={open.label} src={open.dataUrl} className="h-[85vh] w-full max-w-3xl bg-background" />
          )}
        </div>
      )}
    </div>
  );
}
