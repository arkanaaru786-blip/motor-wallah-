import { createFileRoute, Link } from "@tanstack/react-router";
import { LockKeyhole, Database, Share2, Clock, ShieldCheck, UserCheck } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { SUPPORT_EMAIL } from "@/lib/site";

const TITLE = "Privacy Policy | Motor Wallah";
const DESCRIPTION =
  "How Motor Wallah collects, uses, stores and protects your personal data — including KYC documents, mobile numbers and vehicle details — when you buy, sell or service a vehicle.";

export const Route = createFileRoute("/privacy")({
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
      title="Privacy Policy"
      lead="Motor Wallah needs a few details to sell, finance, insure, register or service a vehicle. This page explains exactly what we collect, why we need it, who we share it with and how it is protected."
      updated="8 November 2026"
      meta={
        <>
          <span className="mw-info-chip">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Documents stay private
          </span>
          <span className="mw-info-chip">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> No sale of personal data
          </span>
        </>
      }
    >
      <InfoPanel title="Information we collect" icon={<Database className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            We collect only what a specific request needs. If you are browsing listings, that is
            very little. If you are transferring ownership, it is more.
          </p>
          <ul>
            <li>
              <strong>Contact details:</strong> name, mobile number, email address and, where a
              delivery or visit is involved, your address.
            </li>
            <li>
              <strong>Vehicle details:</strong> make, model, variant, year, registration number,
              kilometres driven, fuel type, insurance history, photographs and any faults you tell
              us about.
            </li>
            <li>
              <strong>KYC documents:</strong> for sales, exchange, finance, insurance and RTO work —
              PAN, Aadhaar or another accepted ID, driving licence, RC, insurance policy, NOC and
              bank details where a loan or refund requires them.
            </li>
            <li>
              <strong>Enquiry content:</strong> the message you send us, the service or vehicle it
              relates to, and the channel you used.
            </li>
            <li>
              <strong>Technical data:</strong> device and browser type, pages visited and basic
              interaction events, so we can keep the site working and measure what is useful.
            </li>
          </ul>
          <p>
            We do not ask for passwords to your bank, UPI PINs, card CVVs or one-time passwords, and
            no Motor Wallah employee will ever ask you to share them.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="How we use it" icon={<UserCheck className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <ul>
            <li>Responding to your enquiry and arranging inspections, test drives or bookings.</li>
            <li>
              Preparing and processing a sale, purchase, exchange, finance application, insurance
              policy, warranty or roadside assistance request.
            </li>
            <li>
              Completing RTO formalities such as ownership transfer, NOC, hypothecation and address
              change with the concerned authority.
            </li>
            <li>Delivering parts and decor orders and handling returns or warranty claims.</li>
            <li>
              Service reminders, booking confirmations and updates about a request you have already
              made.
            </li>
            <li>Fraud prevention, dispute resolution, accounting and legal compliance.</li>
            <li>
              Improving our catalogue, pricing guidance and support quality using aggregated,
              non-identifying usage patterns.
            </li>
          </ul>
          <p>
            We send marketing messages only where you have agreed to receive them, and every message
            includes a way to opt out.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="How your data is protected" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            Documents and enquiry details are stored on access-controlled systems, transferred over
            encrypted connections, and restricted to the team members and partners who need them for
            your request. KYC files are never posted inside chat, email or public listings.
          </p>
          <ul>
            <li>Encryption in transit for every form and upload.</li>
            <li>Role-based access inside our own systems, with staff actions logged.</li>
            <li>Documents retained only as long as the transaction or law requires.</li>
            <li>
              Vendor and partner access limited to the specific file needed for the specific job.
            </li>
          </ul>
          <div className="mw-info-note">
            If you believe a document was shared in error, contact us immediately at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will restrict access
            while we investigate.
          </div>
        </div>
      </InfoPanel>

      <InfoPanel title="Who we share it with" icon={<Share2 className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>We share the minimum necessary with:</p>
          <ul>
            <li>
              <strong>Banks and NBFCs</strong> — when you ask us to arrange vehicle finance, or an
              existing lender needs a NOC.
            </li>
            <li>
              <strong>Insurers</strong> — to quote, issue, renew or claim a policy you requested.
            </li>
            <li>
              <strong>RTO agents and authorities</strong> — to complete registration and transfer
              work.
            </li>
            <li>
              <strong>Workshops, detailers and decor fitters</strong> — the vehicle and job details
              needed to carry out your booking.
            </li>
            <li>
              <strong>Delivery and payment partners</strong> — for fulfilling orders and processing
              refunds.
            </li>
            <li>
              <strong>Professional advisers and authorities</strong> — where the law, a court order
              or a genuine fraud investigation requires it.
            </li>
          </ul>
          <p>
            We do not sell, rent or trade your personal data, and we do not allow partners to use it
            for their own marketing.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="Retention, cookies and your choices" icon={<Clock className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            Enquiries are kept while the conversation is live and for a reasonable follow-up window.
            Transaction, invoice, warranty and RTO records are kept for the period required by tax
            and motor-vehicle rules. Documents collected for a purpose that did not proceed are
            deleted or anonymised.
          </p>
          <p>
            The site uses cookies and local storage for essentials such as your session, shortlist
            and saved searches. You can clear them from your browser at any time; clearing storage
            may sign you out or reset saved filters.
          </p>
          <p>You may ask us to:</p>
          <ul>
            <li>confirm what personal data we hold about you and receive a copy;</li>
            <li>correct anything inaccurate;</li>
            <li>delete data we no longer need or are not required to keep;</li>
            <li>stop marketing messages while keeping service updates.</li>
          </ul>
          <p>
            Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the mobile number
            used on the enquiry. We respond within a reasonable period and may ask you to verify
            your identity first, so documents are never released to the wrong person.
          </p>
          <p>
            Questions about this policy, or a concern about how your data was handled, can be raised
            through our <Link to="/contact">contact page</Link>.
          </p>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
