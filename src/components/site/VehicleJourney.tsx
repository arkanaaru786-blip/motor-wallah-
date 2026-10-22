import { useState } from "react";
import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";
import { submitLead, type LeadType } from "@/lib/leads";
import {
  ANY,
  VehicleSelectorFields,
  selectionToFields,
  useVehicleSelection,
} from "@/components/site/VehicleSelector";

export type JourneyField = {
  name: string;
  label: string;
  type?: "text" | "tel" | "number" | "select" | "textarea";
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
};

export function VehicleJourney({
  title,
  highlight,
  description,
  ctaLabel,
  formTitle,
  fields,
  leadType,
  source,
  whatsappMessage,
}: {
  title: string;
  highlight: string;
  description: string;
  ctaLabel: string;
  formTitle: string;
  fields: JourneyField[];
  leadType: LeadType;
  source: string;
  whatsappMessage: string;
}) {
  const { selection, set, setBrand, setYear } = useVehicleSelection();
  const [step, setStep] = useState<"select" | "details">("select");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleChosen = selection.brand !== ANY && selection.model !== ANY;

  const start = () => {
    if (!vehicleChosen) {
      setError("Please select your car brand and model to continue.");
      return;
    }
    setError(null);
    setStep("details");
    requestAnimationFrame(() => {
      document.getElementById("journey-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values: Record<string, string> = { ...selectionToFields(selection) };
    fields.forEach((f) => {
      const v = String(data.get(f.name) ?? "").trim();
      if (v) values[f.name] = v.slice(0, 200);
    });
    await submitLead({
      type: leadType,
      source,
      location: selection.location !== ANY ? selection.location : undefined,
      vehicleName: `${selection.brand} ${selection.model}`.trim(),
      name: values["name"] ?? undefined,
      mobile: values["mobile"] ?? undefined,
      fields: values,
    });
    setDone(true);
  };

  return (
    <div id="top" className="flex min-h-screen flex-col bg-background pb-14 md:pb-0">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-ink py-14 text-ink-foreground lg:py-20">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl lg:text-5xl">
              {title} <span className="text-primary">{highlight}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-foreground/80">{description}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Drive Trust. Drive Quality.
            </p>
          </div>
        </section>

        <section className="bg-secondary/60 py-10 lg:py-14">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <div className="border border-border bg-card p-5 shadow-panel lg:p-7">
              <h2 className="font-display text-xl font-bold uppercase">
                Select Your <span className="text-primary">Car Details</span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Same brand, model and year database used across Motor Wallah — including older and
                discontinued models.
              </p>

              <div className="mt-5">
                <VehicleSelectorFields
                  selection={selection}
                  set={set}
                  setBrand={setBrand}
                  setYear={setYear}
                  priceLabel={leadType === "sell_car" ? "Expected Price" : "Budget"}
                />
              </div>

              {error && <p className="mt-4 text-xs font-semibold text-primary">{error}</p>}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  {ctaLabel}
                </button>
                <a
                  href={whatsappLink(whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp Us
                </a>
                <a
                  href={PHONE_HREF}
                  className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
                >
                  <Phone className="h-4 w-4" /> Call {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </section>

        {step === "details" && (
          <section id="journey-form" className="py-12 lg:py-16">
            <div className="mx-auto max-w-[900px] px-4 lg:px-8">
              <div className="border border-border bg-card p-5 sm:p-7">
                {done ? (
                  <div className="py-10 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
                    <p className="mt-4 font-display text-2xl uppercase">Request Received</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Our Motor Wallah team will contact you shortly with your valuation.
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-bold uppercase">{formTitle}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selection.year !== ANY ? `${selection.year} ` : ""}
                      {selection.brand} {selection.model}
                      {selection.variant ? ` ${selection.variant}` : ""}
                    </p>
                    <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
                      {fields.map((f) => (
                        <label
                          key={f.name}
                          className={`block min-w-0 border border-border bg-background px-3 py-2 ${
                            f.type === "textarea" ? "sm:col-span-2" : ""
                          }`}
                        >
                          <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                            {f.label}
                            {f.required ? " *" : ""}
                          </span>
                          {f.type === "select" ? (
                            <select
                              name={f.name}
                              required={f.required}
                              defaultValue=""
                              className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                            >
                              <option value="">Select</option>
                              {(f.options ?? []).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : f.type === "textarea" ? (
                            <textarea
                              name={f.name}
                              rows={3}
                              maxLength={500}
                              required={f.required}
                              placeholder={f.placeholder ?? ""}
                              className="w-full resize-none bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
                            />
                          ) : (
                            <input
                              name={f.name}
                              type={f.type ?? "text"}
                              required={f.required}
                              maxLength={f.type === "tel" ? 15 : 80}
                              placeholder={f.placeholder ?? ""}
                              className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
                            />
                          )}
                        </label>
                      ))}

                      <button
                        type="submit"
                        className="sm:col-span-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
                      >
                        {ctaLabel}
                      </button>
                      <p className="sm:col-span-2 text-[0.7rem] text-muted-foreground">
                        Your final valuation is confirmed after a Motor Wallah evaluation at our
                        centre.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
