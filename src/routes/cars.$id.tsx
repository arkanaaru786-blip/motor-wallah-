import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Car, Check, Fuel, Gauge, MapPin, MessageCircle, Phone, Settings2, ShieldCheck } from "lucide-react";
import {
  NOT_AVAILABLE,
  TO_BE_VERIFIED,
  formatKm,
  formatPrice,
  getVehicle,
  vehicleName,
  type Vehicle,
} from "@/lib/cars-data";
import { PHONE_HREF, whatsappLink } from "@/lib/site";
import { TestDriveDialog } from "@/components/site/TestDriveDialog";
import { InspectionDialog } from "@/components/site/InspectionDialog";
import { EnquiryDialog } from "@/components/site/EnquiryDialog";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/cars/$id")({
  loader: ({ params }) => {
    const vehicle = getVehicle(params.id);
    if (!vehicle) throw notFound();
    return { vehicle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Vehicle Unavailable | Motor Wallah" }, { name: "robots", content: "noindex" }] };
    }
    const v = loaderData.vehicle;
    const title = `${vehicleName(v)} — ${formatPrice(v.price)} | Motor Wallah ${v.location}`;
    const description = `${vehicleName(v)} in ${v.location}: ${formatKm(v.kilometres)}, ${v.fuel}, ${v.transmission}, ${v.bodyType}. Demo listing pending real inventory confirmation.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: VehicleNotFound,
  component: Page,
});

function VehicleNotFound() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-24 text-center lg:px-8">
      <p className="font-display text-3xl uppercase">Vehicle Not Found</p>
      <p className="mt-2 text-sm text-muted-foreground">This listing is no longer available.</p>
      <Link to="/cars" className="mt-6 inline-block bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground">
        Back to All Cars
      </Link>
    </div>
  );
}

function Row({ label, value, fallback = NOT_AVAILABLE }: { label: string; value: string | null; fallback?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold ${value ? "" : "text-muted-foreground"}`}>{value ?? fallback}</dd>
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-border bg-card px-3 py-3">
      <div className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border border-border bg-card p-5">
      <h2 className="font-display text-xl uppercase">{title}</h2>
      {children}
    </div>
  );
}

function Page() {
  const { vehicle } = Route.useLoaderData() as { vehicle: Vehicle };
  const [testDrive, setTestDrive] = useState(false);
  const [inspection, setInspection] = useState(false);
  const [finance, setFinance] = useState(false);
  const [insurance, setInsurance] = useState(false);
  const [warranty, setWarranty] = useState(false);
  const name = vehicleName(vehicle);
  const sold = vehicle.status === "Sold";
  const report = vehicle.inspection;
  const enquiry = whatsappLink(
    `Hello MOTOR WALLAH, I am interested in the ${name} priced at ${formatPrice(vehicle.price)}. I would like to know more about this vehicle.`,
  );

  return (
    <div className="overflow-x-hidden pb-24 md:pb-10">
      <section className="bg-ink py-8 text-ink-foreground">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
          <Link to="/cars" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground/70 hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> All Cars
          </Link>
          <h1 className="mt-4 font-display text-3xl uppercase tracking-tight sm:text-4xl">{name}</h1>
          <p className="mt-2 text-2xl font-bold text-primary">{formatPrice(vehicle.price)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-ink-foreground/70">
            {formatKm(vehicle.kilometres)} · {vehicle.fuel} · {vehicle.transmission} · {vehicle.bodyType} · {vehicle.location}
          </p>
        </div>
      </section>

      <section className="bg-background py-8">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 lg:grid-cols-[1.4fr_1fr] lg:px-8">
          <div className="min-w-0">
            <VehicleGallery
              images={vehicle.images}
              alt={`${vehicle.bodyType} demo placeholder photo for ${name}`}
              className="border border-border"
              overlay={
                <>
                  <div className="absolute left-0 top-0 flex flex-col items-start gap-1 p-3">
                    <span className="bg-primary px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-primary-foreground">
                      Motor Wallah Certified
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspection(true)}
                      className="bg-ink px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-ink-foreground hover:underline"
                    >
                      150+ Point Inspection
                    </button>
                    {vehicle.demo && (
                      <span className="border border-border bg-card px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide">
                        Demo Listing
                      </span>
                    )}
                  </div>
                  <span className="absolute right-3 top-3 bg-ink px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-ink-foreground">
                    {vehicle.status}
                  </span>
                </>
              }
            />

            <p className="mt-3 text-xs text-muted-foreground">
              Photos shown are neutral demo placeholders. Actual vehicle photos are shared once real Motor Wallah
              inventory is connected.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Spec icon={<Gauge className="h-4 w-4 text-primary" />} label="Kilometres" value={formatKm(vehicle.kilometres)} />
              <Spec icon={<Fuel className="h-4 w-4 text-primary" />} label="Fuel" value={vehicle.fuel} />
              <Spec icon={<Settings2 className="h-4 w-4 text-primary" />} label="Transmission" value={vehicle.transmission} />
              <Spec icon={<Car className="h-4 w-4 text-primary" />} label="Body Type" value={vehicle.bodyType} />
              <Spec icon={<MapPin className="h-4 w-4 text-primary" />} label="Location" value={vehicle.location} />
              <Spec icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Status" value={vehicle.status} />
            </div>

            {/* Certification */}
            <Section title="Motor Wallah Certification">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-primary bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-display text-xl uppercase text-foreground">MOTOR WALLAH CERTIFIED</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">150+ POINT QUALITY INSPECTION</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Vehicle assessed through the MOTOR WALLAH quality evaluation process.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  "Quality Checked",
                  "Vehicle Condition Assessed",
                  "Documentation Checked",
                  "Road Test Assessed",
                ].map((label) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs font-semibold">
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{label}</span>
                  </span>
                ))}
              </div>

              {report?.inspectedOn && (
                <div className="mt-4 grid gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <p>
                    Inspection Date:{" "}
                    <span className="font-semibold text-foreground">{report.inspectedOn}</span>
                  </p>
                  {report.certificationId && (
                    <p>
                      Certification ID:{" "}
                      <span className="font-semibold text-foreground">{report.certificationId}</span>
                    </p>
                  )}
                </div>
              )}

              {vehicle.demo && (
                <p className="mt-4 border border-primary/40 bg-primary/10 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide text-primary">
                  DEMO CERTIFICATION
                </p>
              )}
            </Section>

            {/* History */}
            <Section title="Vehicle History">
              <dl className="mt-3">
                <Row label="Registration year" value={vehicle.registrationYear ? String(vehicle.registrationYear) : null} />
                <Row label="Ownership" value={vehicle.ownership} />
                <Row label="Insurance validity" value={vehicle.insuranceValidity} fallback={TO_BE_VERIFIED} />
                <Row label="Service history" value={vehicle.serviceHistory} fallback={TO_BE_VERIFIED} />
                <Row label="Accident history" value={vehicle.accidentHistory} fallback={TO_BE_VERIFIED} />
                <Row label="RC status" value={vehicle.rcStatus} fallback={TO_BE_VERIFIED} />
                <Row label="Challan status" value={vehicle.challanStatus} fallback={TO_BE_VERIFIED} />
                <Row label="Hypothecation status" value={vehicle.hypothecationStatus} fallback={TO_BE_VERIFIED} />
                <Row label="PUC status" value={vehicle.pucStatus} fallback={TO_BE_VERIFIED} />
                <Row label="RTO" value={vehicle.rto} />
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Motor Wallah does not publish unverified vehicle history. Fields marked “{TO_BE_VERIFIED}” are confirmed
                with documentation before purchase.
              </p>
            </Section>

            {/* Documents */}
            <Section title="Documents">
              <ul className="mt-3 divide-y divide-border border border-border">
                {vehicle.documents.map((d) => (
                  <li key={d.label} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <span className="font-semibold">{d.label}</span>
                    <span className={`text-xs uppercase tracking-wide ${d.verified ? "text-primary" : "text-muted-foreground"}`}>
                      {d.verified ? "Verified" : TO_BE_VERIFIED}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Finance / Insurance / Warranty */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="border border-border bg-card p-5">
                <p className="font-display text-lg uppercase">Easy Finance Available</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share your details and our team will guide you. No approval or EMI is promised online.
                </p>
                <button
                  type="button"
                  onClick={() => setFinance(true)}
                  className="mt-4 w-full bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
                >
                  Finance Enquiry
                </button>
              </div>
              <div className="border border-border bg-card p-5">
                <p className="font-display text-lg uppercase">Insurance Assistance</p>
                <p className="mt-1 text-xs text-muted-foreground">Request a quote from our insurance desk.</p>
                <button
                  type="button"
                  onClick={() => setInsurance(true)}
                  className="mt-4 w-full border border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary"
                >
                  Request Insurance Quote
                </button>
              </div>
              <div className="border border-border bg-card p-5">
                <p className="font-display text-lg uppercase">Extended Warranty</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Provider: {vehicle.warrantyProvider ?? TO_BE_VERIFIED}. Warranty is offered through partner providers.
                </p>
                <button
                  type="button"
                  onClick={() => setWarranty(true)}
                  className="mt-4 w-full border border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary"
                >
                  Warranty Enquiry
                </button>
              </div>
            </div>

            <Section title="Vehicle Overview">
              <p className="mt-2 text-sm text-muted-foreground">{vehicle.description ?? NOT_AVAILABLE}</p>
              <dl className="mt-4">
                <Row label="Exterior condition" value={vehicle.exteriorCondition} fallback={TO_BE_VERIFIED} />
                <Row label="Interior condition" value={vehicle.interiorCondition} fallback={TO_BE_VERIFIED} />
                <Row label="Engine & mechanical condition" value={vehicle.engineCondition} fallback={TO_BE_VERIFIED} />
                <Row label="Tyres" value={vehicle.tyres} fallback={TO_BE_VERIFIED} />
              </dl>
            </Section>
          </div>

          {/* Action panel */}
          <aside className="h-fit border border-border bg-card p-5 shadow-panel lg:sticky lg:top-24">
            <p className="font-display text-xl uppercase">Interested in this car?</p>
            <p className="mt-1 text-sm text-muted-foreground">Talk to the Motor Wallah team in {vehicle.location}.</p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={sold}
                onClick={() => setTestDrive(true)}
                className="bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {sold ? "Sold" : "Book Test Drive"}
              </button>
              <a
                href={enquiry}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => submitLead({ type: "whatsapp_click", source: "vehicle_detail", vehicleId: vehicle.id, vehicleName: name })}
                className="flex items-center justify-center gap-2 border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a
                href={PHONE_HREF}
                onClick={() => submitLead({ type: "call_click", source: "vehicle_detail", vehicleId: vehicle.id, vehicleName: name })}
                className="flex items-center justify-center gap-2 bg-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-foreground"
              >
                <Phone className="h-4 w-4" /> Call Now
              </a>
              <button
                type="button"
                onClick={() => setFinance(true)}
                className="border border-border px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
              >
                Get Finance
              </button>
              <Link
                to="/contact"
                className="border border-border px-6 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary"
              >
                Enquire Now
              </Link>
            </div>
            {vehicle.demo && (
              <p className="mt-4 text-xs text-muted-foreground">
                Demo listing — not confirmed Motor Wallah inventory.
              </p>
            )}
          </aside>
        </div>
      </section>

      <TestDriveDialog vehicle={vehicle} open={testDrive} onClose={() => setTestDrive(false)} />
      <InspectionDialog vehicle={vehicle} open={inspection} onClose={() => setInspection(false)} />
      <EnquiryDialog
        open={finance}
        onClose={() => setFinance(false)}
        title="Finance Enquiry"
        vehicle={vehicle}
        leadType="finance_enquiry"
        source="vehicle_detail_finance"
        submitLabel="Submit Finance Enquiry"
        disclaimer="Loan eligibility, interest rate and approval are decided by partner lenders. Nothing is approved online."
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "mobile", label: "Mobile Number", type: "tel", required: true },
          { name: "employment", label: "Employment Type", type: "select", options: ["Salaried", "Self Employed", "Business", "Other"] },
          { name: "income", label: "Monthly Income (₹)", type: "number" },
          { name: "loanAmount", label: "Preferred Loan Amount (₹)", type: "number" },
        ]}
      />
      <EnquiryDialog
        open={insurance}
        onClose={() => setInsurance(false)}
        title="Insurance Quote Request"
        vehicle={vehicle}
        leadType="insurance_enquiry"
        source="vehicle_detail_insurance"
        submitLabel="Request Quote"
        disclaimer="Quotes are issued by partner insurers after document verification."
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "mobile", label: "Mobile Number", type: "tel", required: true },
          { name: "message", label: "Message", type: "textarea" },
        ]}
      />
      <EnquiryDialog
        open={warranty}
        onClose={() => setWarranty(false)}
        title="Extended Warranty Enquiry"
        vehicle={vehicle}
        leadType="warranty_enquiry"
        source="vehicle_detail_warranty"
        submitLabel="Send Enquiry"
        disclaimer="Extended warranty is provided by partner providers, not by Motor Wallah directly."
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "mobile", label: "Mobile Number", type: "tel", required: true },
          { name: "message", label: "Message", type: "textarea" },
        ]}
      />
    </div>
  );
}
