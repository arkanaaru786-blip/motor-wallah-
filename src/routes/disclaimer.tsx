import { createFileRoute, Link } from "@tanstack/react-router";
import { Handshake, Info, TriangleAlert, Landmark } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

const TITLE = "Disclaimer | Motor Wallah";
const DESCRIPTION =
  "Motor Wallah is a vehicle marketplace and service facilitator. Read what we do and do not guarantee about listings, prices, documents and third-party services.";

export const Route = createFileRoute("/disclaimer")({
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
      title="Disclaimer"
      lead="Motor Wallah brings buyers, sellers and service partners together. This page sets out plainly what that means — and what we do not claim to be."
      updated="8 November 2026"
      meta={
        <>
          <span className="mw-info-chip">
            <Handshake className="h-3.5 w-3.5" aria-hidden="true" /> Marketplace, not the seller
          </span>
          <span className="mw-info-chip">
            <Info className="h-3.5 w-3.5" aria-hidden="true" /> Information, not a guarantee
          </span>
        </>
      }
    >
      <InfoPanel
        title="We are a marketplace and facilitator"
        icon={<Handshake className="h-4 w-4" />}
      >
        <div className="mw-info-prose">
          <p>
            <strong>
              Motor Wallah is an online marketplace and service facilitator. It is not the direct
              seller or manufacturer of every vehicle, part or accessory listed on the site.
            </strong>
          </p>
          <p>
            Unless a specific invoice, sale agreement or order confirmation names Motor Wallah as
            the seller, the sale is between you and the seller shown on that record. Where a
            dealership, workshop, financier or insurer provides a product or service, that provider
            is responsible for it and its own terms apply.
          </p>
          <p>
            Motor Wallah&apos;s role is to publish listings, verify what can reasonably be verified,
            coordinate enquiries, bookings and paperwork, and support you if something goes wrong.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="Listings and vehicle information" icon={<Info className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <ul>
            <li>
              Prices, kilometre readings, variant names, ownership counts and document status are
              recorded from the seller and the documents available to us. They can change and may
              contain errors.
            </li>
            <li>
              Photographs are illustrative of the actual vehicle at the time of listing. Colour,
              finish and small details can differ from what you see on your screen.
            </li>
            <li>
              An inspection report describes the condition observed on the day of inspection. It is
              not a warranty of future reliability and does not cover hidden or developing faults.
            </li>
            <li>
              You are encouraged to inspect the vehicle in person, take a test drive and, where you
              want extra certainty, arrange an independent mechanic or a third-party check.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel
        title="Finance, insurance and RTO outcomes"
        icon={<Landmark className="h-4 w-4" />}
      >
        <div className="mw-info-prose">
          <p>
            Loan eligibility, interest rates, insurance premiums and claim decisions rest solely
            with the bank, NBFC, insurer or authority concerned. Any figure shown on this site —
            including an EMI estimate, premium estimate or processing time — is indicative and not
            an offer or a commitment on their behalf.
          </p>
          <p>
            RTO processing times depend on the regional transport office. We file correctly and
            follow up, but we cannot promise a date that the office controls.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="Accuracy, links and liability" icon={<TriangleAlert className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            The site is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We work
            to keep it accurate and available, but we do not warrant that every page will be
            uninterrupted or free of typographical error.
          </p>
          <p>
            Links to third-party sites, partner portals and payment gateways are provided for
            convenience. We do not control their content or privacy practices, and a link is not an
            endorsement.
          </p>
          <p>
            To the extent permitted by law, Motor Wallah is not liable for indirect or consequential
            loss arising from reliance on a listing, a third-party product or service, or a delay
            outside our control. Nothing here excludes liability that cannot be excluded under
            Indian law.
          </p>
          <p>
            Spotted something wrong on a listing or page? Tell us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will review it. For the
            contractual rules of using this site, read our{" "}
            <Link to="/terms">terms &amp; conditions</Link>.
          </p>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
