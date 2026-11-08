import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronDown, CircleHelp, Compass } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL, WHATSAPP } from "@/lib/site";

const TITLE = "Frequently Asked Questions | Motor Wallah";
const DESCRIPTION =
  "Answers to the questions we hear most — how to sell a car on Motor Wallah, inspections, finance, insurance, RTO transfer, service bookings, parts returns, warranty and support.";

export const Route = createFileRoute("/faqs")({
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

type Faq = { q: string; a: ReactNode };

const SELLING: Faq[] = [
  {
    q: "How do I sell my car on Motor Wallah?",
    a: (
      <>
        Start on the <Link to="/sell-your-car">Sell your car</Link> page and enter the registration
        number, make, model, year, kilometres and your expected price. You can upload photos and RC
        copies there. Our team reviews the details, arranges an inspection, and confirms an offer.
        If you accept, we collect the vehicle and documents, complete the transfer paperwork and pay
        you as agreed — usually by bank transfer once the documents are verified.
      </>
    ),
  },
  {
    q: "Is the inspection free, and what does it cover?",
    a: (
      <>
        Inspection is free when you sell or exchange a vehicle through us. It covers engine,
        transmission, suspension, brakes, electricals, structure, tyres, interiors and a road test.
        The report records what was observed on the day; it is not a strip-down mechanical warranty.
        You receive a summary before you decide.
      </>
    ),
  },
  {
    q: "Can I exchange my old vehicle for another one?",
    a: (
      <>
        Yes. Use the <Link to="/exchange">Exchange</Link> flow to tell us about your current vehicle
        and the one you want. We value the old vehicle, adjust it against the new one and handle the
        RC transfer and NOC. If a loan is running on the old vehicle, we coordinate the foreclosure
        and NOC with the lender.
      </>
    ),
  },
  {
    q: "Do you arrange finance and insurance?",
    a: (
      <>
        We help you apply through banks, NBFCs and insurers we work with. Approval, interest rate,
        tenure and premium are decided by that institution based on your profile and the vehicle.
        You can start at <Link to="/finance">Finance</Link> or{" "}
        <Link to="/insurance">Insurance</Link>. Any EMI or premium shown on the site is an estimate
        until the lender or insurer issues a quote.
      </>
    ),
  },
  {
    q: "Who handles the RC transfer and other RTO work?",
    a: (
      <>
        We do. Ownership transfer, NOC, duplicate RC, address change, hypothecation entry and
        removal are handled by our RTO desk — see <Link to="/rto">RTO services</Link>. You share the
        documents once, and we file with the regional transport office and keep you updated.
        Government timelines vary by office.
      </>
    ),
  },
];

const SERVICE: Faq[] = [
  {
    q: "How do I book a service or repair?",
    a: (
      <>
        Book from the <Link to="/services">Service</Link> page: choose the vehicle, the work you
        need and a slot. You will get a confirmation with the booking reference, and the workshop
        updates the job status as it progresses — including parts delays. You can reschedule free of
        charge up to 12 hours before the slot.
      </>
    ),
  },
  {
    q: "What is the return policy on parts and decor?",
    a: (
      <>
        Unused items in original packaging can be returned within 7 days of delivery. Electricals,
        custom-stitched items and special-order parts are not returnable once fitted or used. If
        something arrives damaged or does not fit, tell us within 48 hours with photos and we
        collect it at our cost. Full details are in the{" "}
        <Link to="/refund">refund &amp; cancellation policy</Link>.
      </>
    ),
  },
  {
    q: "How do I track my order or service status?",
    a: (
      <>
        Use <Link to="/track">Track</Link> with the reference we sent you — an order reference such
        as MW-ORD-…, a job card number or a booking ID. The page shows the current status and the
        next step. If you do not have the reference, call us and we will look it up by mobile
        number.
      </>
    ),
  },
  {
    q: "What does the warranty cover, and what is roadside assistance?",
    a: (
      <>
        Warranty cover depends on the vehicle, its age and its service history; it typically
        protects specified engine and transmission components against sudden failure, subject to
        exclusions such as consumables and accident damage. Roadside assistance covers breakdowns —
        towing, jump start, flat tyre, fuel delivery and key assistance — within the covered area.
        See <Link to="/warranty-rsa">Warranty &amp; RSA</Link> and request a check for your vehicle.
      </>
    ),
  },
  {
    q: "How do I contact support?",
    a: (
      <>
        Call <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>, WhatsApp us on{" "}
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
          this number
        </a>
        , or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. The{" "}
        <Link to="/contact">contact page</Link> also has a form that reaches the same team. We are
        in Indore, Madhya Pradesh, and reply within one working day.
      </>
    ),
  },
];

function FaqGroup({ title, items }: { title: string; items: Faq[] }) {
  return (
    <InfoPanel title={title} icon={<CircleHelp className="h-4 w-4" />}>
      <div className="mw-info-faq">
        {items.map((item) => (
          <details key={item.q}>
            <summary>
              {item.q}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="mw-info-faq-body">{item.a}</div>
          </details>
        ))}
      </div>
    </InfoPanel>
  );
}

function Page() {
  return (
    <InfoPage
      eyebrow="Support"
      title="Frequently Asked Questions"
      lead="Ten answers that cover most of what people ask us — selling, buying, finance, RTO paperwork, service bookings, parts returns and support. If yours is not here, the team is one call away."
      meta={
        <>
          <span className="mw-info-chip">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> 10 common questions
          </span>
          <span className="mw-info-chip">Indore · Madhya Pradesh</span>
        </>
      }
      aside={
        <div className="mw-info-panel mw-info-panel--tight">
          <p className="mw-info-tile-label">Popular actions</p>
          <div className="mw-info-help mt-3">
            <Link to="/buy">
              <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Browse vehicles
                <small>All eight categories</small>
              </span>
            </Link>
            <Link to="/sell-your-car">
              <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Sell your vehicle
                <small>Get a valuation</small>
              </span>
            </Link>
            <Link to="/services">
              <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Book a service
                <small>Pick a slot</small>
              </span>
            </Link>
            <Link to="/track">
              <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Track a request
                <small>Order, job card or booking</small>
              </span>
            </Link>
          </div>
        </div>
      }
    >
      <FaqGroup title="Buying & selling" items={SELLING} />
      <FaqGroup title="Service, parts & support" items={SERVICE} />
      <InfoPanel title="Still need an answer?">
        <div className="mw-info-prose">
          <p>
            Send the question through the <Link to="/contact">contact form</Link>, call{" "}
            <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>, or email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include the order or booking
            reference if you have one — it saves a round trip.
          </p>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
