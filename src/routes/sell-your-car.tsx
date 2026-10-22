import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { PhotoUploader } from "@/components/site/PhotoUploader";
import { DocumentUploader } from "@/components/site/DocumentUploader";
import {
  ANY,
  VehicleSelectorFields,
  selectionToFields,
  useVehicleSelection,
} from "@/components/site/VehicleSelector";
import { submitLead } from "@/lib/leads";
import { EXTERIOR_SLOTS, MIN_EXTERIOR_PHOTOS, type UploadedFile } from "@/lib/uploads";
import { estimateValue, formatINR, type Valuation } from "@/lib/valuation";
import { LOCATIONS } from "@/lib/cars-data";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Sell Your Car | Motor Wallah";
const DESCRIPTION =
  "Share your car details, photos and RC to get an indicative Motor Wallah market estimate before a final offer.";

export const Route = createFileRoute("/sell-your-car")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Field = {
  name: string;
  label: string;
  type?: "text" | "tel" | "email" | "number" | "select";
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
};

const VEHICLE_FIELDS: Field[] = [
  { name: "registration", label: "Registration Number", required: true, placeholder: "MP09 AB 1234" },
  { name: "currentKm", label: "Current Kilometres", type: "number", required: true, placeholder: "e.g. 48500" },
  {
    name: "expectedPrice",
    label: "Expected Selling Price (₹)",
    type: "number",
    placeholder: "How much do you expect to get for your car? e.g. 650000",
  },
  {
    name: "ownership",
    label: "Number of Owners",
    type: "select",
    options: ["First Owner", "Second Owner", "Third Owner", "Fourth Owner or more"],
    required: true,
  },
  {
    name: "serviceHistory",
    label: "Service History",
    type: "select",
    options: ["Full Authorised Service", "Partial Records", "Local Workshop", "No Records"],
    required: true,
  },
  {
    name: "accidentHistory",
    label: "Accident / Damage History",
    type: "select",
    options: ["No Accident", "Minor Repair", "Major Repair", "Not Sure"],
    required: true,
  },
  {
    name: "condition",
    label: "Vehicle Condition",
    type: "select",
    options: ["Excellent", "Good", "Average", "Needs Work"],
    required: true,
  },
  {
    name: "tyreCondition",
    label: "Tyre Condition",
    type: "select",
    options: ["New", "Good", "Average", "Replacement Needed"],
    required: true,
  },
  {
    name: "insuranceStatus",
    label: "Insurance Status",
    type: "select",
    options: ["Valid Comprehensive", "Valid Third Party", "Expired", "Not Sure"],
    required: true,
  },
];

const CUSTOMER_FIELDS: Field[] = [
  { name: "name", label: "Full Name", required: true },
  { name: "mobile", label: "Mobile Number", type: "tel", required: true, placeholder: "10-digit mobile" },
  { name: "whatsapp", label: "WhatsApp Number", type: "tel", placeholder: "If different" },
  { name: "email", label: "Email (optional)", type: "email", placeholder: "you@example.com" },
  { name: "city", label: "City / Location", type: "select", options: LOCATIONS, required: true },
];

function FieldInput({ f }: { f: Field }) {
  return (
    <label className="block min-w-0 border border-border bg-background px-3 py-2">
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
  );
}

const STEPS = ["Vehicle Details", "Car Information & Uploads", "Estimated Market Value"];

function Page() {
  const { selection, set, setBrand, setYear } = useVehicleSelection();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [rc, setRc] = useState<UploadedFile | null>(null);
  const [insurance, setInsurance] = useState<UploadedFile | null>(null);
  const [puc, setPuc] = useState<UploadedFile | null>(null);
  const [serviceDoc, setServiceDoc] = useState<UploadedFile | null>(null);
  const [bills, setBills] = useState<UploadedFile | null>(null);
  const [noc, setNoc] = useState<UploadedFile | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [finalOffer, setFinalOffer] = useState(false);

  const vehicleChosen = selection.brand !== ANY && selection.model !== ANY;

  const start = () => {
    if (!vehicleChosen) {
      setError("Please select your car brand and model to continue.");
      return;
    }
    setError(null);
    setStep(1);
    requestAnimationFrame(() =>
      document.getElementById("sell-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const exterior = photos.filter((p) => EXTERIOR_SLOTS.includes(p.label)).length;
    if (exterior < MIN_EXTERIOR_PHOTOS) {
      setError(`Please upload at least ${MIN_EXTERIOR_PHOTOS} clear exterior photos of your car.`);
      return;
    }
    if (!rc) {
      setError("Please upload your RC to continue. Insurance is optional.");
      return;
    }
    setError(null);

    const data = new FormData(e.currentTarget);
    const values: Record<string, string> = { ...selectionToFields(selection) };
    [...VEHICLE_FIELDS, ...CUSTOMER_FIELDS].forEach((f) => {
      const v = String(data.get(f.name) ?? "").trim();
      if (v) values[f.name] = v.slice(0, 200);
    });

    const result = estimateValue({
      brand: selection.brand,
      model: selection.model,
      variant: selection.variant,
      year: selection.year !== ANY ? selection.year : undefined,
      fuel: selection.fuel !== ANY ? selection.fuel : undefined,
      transmission: selection.transmission !== ANY ? selection.transmission : undefined,
      location: values["city"],
      currentKm: values["currentKm"],
      ownership: values["ownership"],
      condition: values["condition"],
      accidentHistory: values["accidentHistory"],
      serviceHistory: values["serviceHistory"],
      tyreCondition: values["tyreCondition"],
      insuranceStatus: values["insuranceStatus"],
      hasInsuranceDoc: Boolean(insurance),
    });
    setValuation(result);

    const documents = [rc, insurance, puc, serviceDoc, bills, noc].filter(
      (d): d is UploadedFile => Boolean(d),
    );

    await submitLead({
      type: "sell_car",
      source: "sell-your-car",
      location: values["city"] ?? undefined,
      vehicleName: `${selection.brand} ${selection.model}`.trim(),
      name: values["name"] ?? undefined,
      mobile: values["mobile"] ?? undefined,
      fields: values,
      photos,
      documents,
      estimate: {
        low: result.low,
        high: result.high,
        confidence: result.confidence,
        notes: result.notes,
      },
      expectation: (() => {
        const expectedPrice = Number(values["expectedPrice"]);
        if (!Number.isFinite(expectedPrice) || expectedPrice <= 0) return undefined;
        const aiMidpoint = Math.round((result.low + result.high) / 2);
        const gap = expectedPrice - aiMidpoint;
        return {
          expectedPrice,
          aiMidpoint,
          gap,
          gapPercent: aiMidpoint ? Math.round((gap / aiMidpoint) * 10000) / 100 : 0,
        };
      })(),
    });

    setStep(2);
    requestAnimationFrame(() =>
      document.getElementById("sell-estimate")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div id="top" className="flex min-h-screen flex-col bg-background pb-14 md:pb-0">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-ink py-14 text-ink-foreground lg:py-20">
          <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
            <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl lg:text-5xl">
              Sell Your Car <span className="text-primary">at the Right Price</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-foreground/80">
              Select your car, add photos and your RC, and get an indicative Motor Wallah market
              estimate before a final offer.
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Drive Trust. Drive Quality.
            </p>
          </div>
        </section>

        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-[1600px] flex-wrap gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-[0.65rem] font-bold uppercase tracking-[0.14em] ${
                  i <= step ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {i + 1}. {s}
              </span>
            ))}
          </div>
        </div>

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
                  priceLabel="Expected Price"
                  showPrice={false}
                  showKm={false}
                />
              </div>

              {step === 0 && error && <p className="mt-4 text-xs font-semibold text-primary">{error}</p>}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  Continue
                </button>
                <a
                  href={whatsappLink("Hi Motor Wallah, I want a valuation for my car.")}
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

        {step === 1 && (
          <section id="sell-form" className="py-12 lg:py-16">
            <div className="mx-auto max-w-[1000px] px-4 lg:px-8">
              <form onSubmit={onSubmit} className="grid gap-6">
                <div className="border border-border bg-card p-5 sm:p-7">
                  <h2 className="font-display text-xl font-bold uppercase">
                    Car <span className="text-primary">Information</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selection.year !== ANY ? `${selection.year} ` : ""}
                    {selection.brand} {selection.model}
                    {selection.variant ? ` ${selection.variant}` : ""}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {VEHICLE_FIELDS.map((f) => (
                      <FieldInput key={f.name} f={f} />
                    ))}
                  </div>
                </div>

                <PhotoUploader photos={photos} onChange={setPhotos} />

                <div className="border border-border bg-card p-5 sm:p-7">
                  <h3 className="font-display text-lg font-bold uppercase">
                    Vehicle <span className="text-primary">Documents</span>
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <DocumentUploader
                      label="RC"
                      subtext="Upload a clear photo or scan of your vehicle Registration Certificate."
                      required
                      file={rc}
                      onChange={setRc}
                    />
                    <DocumentUploader
                      label="Insurance Policy"
                      subtext="Optional — Upload your current insurance policy if available."
                      file={insurance}
                      onChange={setInsurance}
                    />
                    <DocumentUploader
                      label="PUC"
                      subtext="Optional — Pollution Under Control certificate."
                      file={puc}
                      onChange={setPuc}
                    />
                    <DocumentUploader
                      label="Service History"
                      subtext="Optional — Service book or workshop records."
                      file={serviceDoc}
                      onChange={setServiceDoc}
                    />
                    <DocumentUploader
                      label="Previous Service Bills"
                      subtext="Optional — Recent repair or service invoices."
                      file={bills}
                      onChange={setBills}
                    />
                    <DocumentUploader
                      label="Loan NOC / Closure"
                      subtext="Optional — Only if the car was financed."
                      file={noc}
                      onChange={setNoc}
                    />
                  </div>
                  {!insurance && (
                    <p className="mt-3 text-[0.7rem] text-muted-foreground">
                      Insurance document not provided. The estimate can still be generated, but
                      document verification may be required before the final purchase offer.
                    </p>
                  )}
                </div>

                <div className="border border-border bg-card p-5 sm:p-7">
                  <h3 className="font-display text-lg font-bold uppercase">
                    Customer <span className="text-primary">Information</span>
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {CUSTOMER_FIELDS.map((f) => (
                      <FieldInput key={f.name} f={f} />
                    ))}
                  </div>
                </div>

                {error && <p className="text-xs font-semibold text-primary">{error}</p>}

                <button
                  type="submit"
                  className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  Get My Car Valued
                </button>
                <p className="text-[0.7rem] text-muted-foreground">
                  Your final valuation is confirmed after a Motor Wallah evaluation at our centre.
                </p>
              </form>
            </div>
          </section>
        )}

        {step === 2 && valuation && (
          <section id="sell-estimate" className="py-12 lg:py-16">
            <div className="mx-auto max-w-[900px] px-4 lg:px-8">
              <div className="border border-border bg-card p-6 text-center sm:p-10">
                <ShieldCheck className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Estimated Market Value
                </p>
                <p className="mt-3 font-display text-3xl font-bold uppercase sm:text-4xl">
                  {formatINR(valuation.low)} <span className="text-primary">–</span>{" "}
                  {formatINR(valuation.high)}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {valuation.label}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Indicative estimate based on the information and market data available.
                </p>

                {valuation.notes.length > 0 && (
                  <ul className="mx-auto mt-4 max-w-xl space-y-1 text-left text-[0.72rem] text-muted-foreground">
                    {valuation.notes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                )}

                {finalOffer ? (
                  <div className="mt-7 border border-border bg-background p-5">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-primary" strokeWidth={1.5} />
                    <p className="mt-3 font-display text-xl uppercase">Request Received</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Our Motor Wallah team will contact you to schedule the inspection and share your
                      final purchase offer.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await submitLead({
                        type: "sell_car",
                        source: "sell-your-car-final-offer",
                        vehicleName: `${selection.brand} ${selection.model}`.trim(),
                        fields: selectionToFields(selection),
                      });
                      setFinalOffer(true);
                    }}
                    className="mt-7 bg-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5"
                  >
                    Get Final Offer
                  </button>
                )}

                <p className="mt-4 text-[0.7rem] text-muted-foreground">
                  Final purchase offer is subject to physical inspection, document verification and
                  vehicle evaluation by MOTOR WALLAH.
                </p>
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
