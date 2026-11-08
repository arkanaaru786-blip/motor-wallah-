import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, ShieldCheck, Wrench, Check, Phone } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { WarrantyLeadForm } from "@/components/site/InfoForms";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

const TITLE = "Warranty & Roadside Assistance | Motor Wallah";
const DESCRIPTION =
  "Mechanical warranty cover on certified Motor Wallah vehicles and 24×7 roadside assistance — towing, jump start, flat tyre, fuel and key help. Check cover for your vehicle.";

export const Route = createFileRoute("/warranty-rsa")({
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

const WARRANTY_POINTS = [
  "Engine and transmission components protected against sudden failure",
  "Cover confirmed per vehicle — age, category and service history decide eligibility",
  "Claims assessed at our own workshop, with labour included as per the plan",
  "Service history recorded so the cover stays valid",
];

const RSA_POINTS = [
  "24×7 helpline with a real person, not a queue",
  "Towing to the nearest Motor Wallah partner workshop",
  "Jump start, flat tyre, fuel delivery and key assistance",
  "Cover across the city and on the highways around Indore",
];

function Page() {
  return (
    <InfoPage
      eyebrow="Services"
      title="Warranty & Roadside Assistance"
      lead="Two forms of backup: a mechanical warranty that protects the expensive parts of a certified vehicle, and roadside assistance for the days a vehicle simply stops. Both are checked against your specific vehicle before anything is promised."
      meta={
        <>
          <span className="mw-info-chip">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mechanical cover
          </span>
          <span className="mw-info-chip">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> 24×7 assistance
          </span>
        </>
      }
    >
      <div className="mw-info-plan-grid">
        <section className="mw-info-plan">
          <span className="mw-info-plan-badge">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Warranty
          </span>
          <h2>Mechanical warranty</h2>
          <p>
            Protects the engine and transmission of a Motor Wallah certified vehicle against sudden
            internal failure — the repairs that can otherwise cost more than a monthly EMI.
          </p>
          <ul className="mw-info-checks">
            {WARRANTY_POINTS.map((point) => (
              <li key={point}>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="text-[0.76rem] leading-relaxed">
            Not covered: routine servicing and consumables (oil, filters, brake pads, tyres,
            battery, bulbs), damage from accident, misuse or overheating, and modifications made
            outside our workshop.
          </p>
          <a href="#warranty-form" className="mw-info-btn mw-info-btn--primary self-start">
            Check warranty cover
          </a>
        </section>

        <section className="mw-info-plan">
          <span className="mw-info-plan-badge">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> RSA
          </span>
          <h2>Roadside assistance</h2>
          <p>
            A breakdown is stressful; being stranded is worse. RSA gets a trained technician to you,
            fixes what can be fixed on the spot, and tows the vehicle if it cannot be.
          </p>
          <ul className="mw-info-checks">
            {RSA_POINTS.map((point) => (
              <li key={point}>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="text-[0.76rem] leading-relaxed">
            Assistance is for mechanical or electrical breakdowns and on-road emergencies. It does
            not cover accident recovery, legal permit issues or repairs at a non-partner workshop
            without approval.
          </p>
          <a href="#warranty-form" className="mw-info-btn mw-info-btn--primary self-start">
            Check RSA cover
          </a>
        </section>
      </div>

      <div id="warranty-form" className="scroll-mt-24">
        <InfoPanel
          title="Check cover for your vehicle"
          subtitle="Give us the vehicle details and our warranty desk will confirm eligibility and the price."
          icon={<Wrench className="h-4 w-4" />}
        >
          <WarrantyLeadForm />
        </InfoPanel>
      </div>

      <InfoPanel title="Already broken down?">
        <div className="mw-info-prose">
          <p>
            Do not wait for a form. Call <a href={PHONE_HREF}>{PHONE_DISPLAY}</a> and tell us where
            you are, the vehicle number and what happened. If it is a Roadside Assistance case, we
            dispatch the nearest technician and share their number with you.
          </p>
          <p>
            For a warranty claim, bring the vehicle to our workshop with the invoice and service
            records. We inspect, confirm the failure is covered, and get your approval before any
            chargeable work begins.
          </p>
        </div>
        <div className="mw-info-btn-row">
          <a href={PHONE_HREF} className="mw-info-btn mw-info-btn--primary">
            <Phone className="h-4 w-4" aria-hidden="true" /> Call {PHONE_DISPLAY}
          </a>
          <Link to="/contact" className="mw-info-btn mw-info-btn--ghost">
            Contact the team
          </Link>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
