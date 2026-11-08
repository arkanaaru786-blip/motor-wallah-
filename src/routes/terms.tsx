import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Scale, ShieldAlert, BadgeCheck } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

const TITLE = "Terms & Conditions | Motor Wallah";
const DESCRIPTION =
  "The rules for using the Motor Wallah marketplace — listings, enquiries, bookings, payments, vehicle inspections and your responsibilities as a buyer or seller.";

export const Route = createFileRoute("/terms")({
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

function Page() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms & Conditions"
      lead="These terms govern your use of the Motor Wallah website and marketplace. By browsing listings, submitting an enquiry or booking a service, you agree to them."
      updated="8 November 2026"
      meta={
        <>
          <span className="mw-info-chip">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Governed by Indian law
          </span>
          <span className="mw-info-chip">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Vehicles sold as inspected
          </span>
        </>
      }
    >
      <InfoPanel title="Using the marketplace" icon={<FileText className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <ul>
            <li>
              You must be at least 18 and legally able to enter a contract to buy, sell, exchange or
              book a vehicle on Motor Wallah.
            </li>
            <li>
              Details you provide — name, mobile number, vehicle information and documents — must be
              true and belong to you or someone who has authorised you to act for them.
            </li>
            <li>
              A listing, price or availability shown on the site is an invitation to enquire. It is
              not a binding offer until both sides confirm in writing.
            </li>
            <li>
              We may suspend accounts, enquiries or listings where we suspect fraud, impersonation
              or misuse, and we may report genuinely unlawful activity.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel
        title="Listings, inspections and vehicle condition"
        icon={<BadgeCheck className="h-4 w-4" />}
      >
        <div className="mw-info-prose">
          <ul>
            <li>
              Photographs and descriptions are prepared in good faith. Colours may vary slightly
              between screens, and accessories shown are included only when the listing says so.
            </li>
            <li>
              Every vehicle we sell is inspected before handover. The inspection covers the points
              listed in the report; it is not a strip-down mechanical or structural guarantee.
            </li>
            <li>
              Used vehicles carry normal wear. Consumables such as tyres, brake pads, batteries,
              wipers, bulbs and fluids wear at their own rate.
            </li>
            <li>
              A test drive is offered before purchase wherever the vehicle is available. Please
              carry a valid driving licence.
            </li>
            <li>
              Odometer readings, ownership history and accident history are recorded as disclosed by
              the previous owner and the documents available to us.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel title="Bookings, payments and charges" icon={<Scale className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <ul>
            <li>
              Prices are shown in Indian rupees and, unless stated otherwise, are exclusive of
              statutory charges such as RTO fees, insurance and applicable taxes.
            </li>
            <li>
              A booking amount confirms intent and holds a vehicle or service slot for the period we
              confirm. It does not transfer ownership.
            </li>
            <li>
              Payments are collected through the channels shown at checkout or on the invoice.
              Always pay to the account or gateway named by Motor Wallah — never to a personal
              number shared over chat.
            </li>
            <li>
              Finance and insurance approval is decided by the bank, NBFC or insurer, not by us. Any
              indicative EMI or premium is an estimate until the lender or insurer issues a quote.
            </li>
            <li>
              RTO fees, government levies and third-party charges can change and are passed through
              at actuals.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel title="What we expect from you" icon={<ShieldAlert className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>When using Motor Wallah you agree not to:</p>
          <ul>
            <li>post false, misleading or duplicate listings, or list a vehicle you do not own;</li>
            <li>
              submit another person&apos;s documents, phone number or details without their consent;
            </li>
            <li>
              copy, scrape or republish listing content, photographs or pricing without permission;
            </li>
            <li>
              attempt to interfere with the site&apos;s security, availability or normal operation;
            </li>
            <li>
              use the marketplace to harass staff, partners or other customers, or to send spam.
            </li>
          </ul>
          <p>
            Vehicle and listing content on this site belongs to Motor Wallah or its licensors and
            may not be reused commercially without written permission.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="Our role and limits">
        <div className="mw-info-prose">
          <p>
            Motor Wallah operates a marketplace and support service. Unless an invoice names us as
            the seller, the sale of a vehicle, part or accessory is between you and the seller, and
            the supply of a service is between you and the provider. Our{" "}
            <Link to="/disclaimer">disclaimer</Link> explains this in more detail.
          </p>
          <p>
            To the extent permitted by law, we are not liable for indirect or consequential loss,
            loss of profit or loss of use arising from a listing, a third-party service or a delay
            outside our control. Nothing in these terms limits liability that cannot be limited
            under Indian law, including for fraud or death or personal injury caused by negligence.
            Claims relating to a vehicle are subject to the warranty or inspection terms stated in
            the sale documents.
          </p>
          <p>
            We may update these terms as the marketplace changes. The version published here, with
            its date, is the version that applies. Continued use after a change means you accept the
            updated terms.
          </p>
          <p>
            These terms are governed by Indian law. Disputes are subject to the jurisdiction of the
            courts at Indore, Madhya Pradesh. Questions can be sent to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
