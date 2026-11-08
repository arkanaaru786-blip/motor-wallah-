import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { InfoPage, InfoPanel, InfoChecks } from "@/components/site/InfoPage";
import { PHONE_DISPLAY, PHONE_HREF } from "@/lib/site";

const TITLE = "RTO Services — RC Transfer, NOC & More | Motor Wallah";
const DESCRIPTION =
  "RC transfer, NOC, duplicate RC, address change and hypothecation work handled by the Motor Wallah RTO desk in Indore. See documents needed, timelines and talk to the team.";

export const Route = createFileRoute("/rto")({
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

const SERVICES = [
  {
    icon: RefreshCcw,
    title: "RC transfer (ownership transfer)",
    body: "The RC moves into the buyer's name with Form 29 and 30, the seller's documents and the transfer fee. We prepare the file, file it at the RTO and follow it until the new RC is issued.",
  },
  {
    icon: FileText,
    title: "NOC for another state",
    body: "Taking the vehicle out of Madhya Pradesh, or bringing one in? We obtain the no-objection certificate, then handle re-registration in the destination state so the vehicle is legal on both sides.",
  },
  {
    icon: ClipboardList,
    title: "Duplicate RC",
    body: "Lost, damaged or faded RC replaced with an affidavit, FIR or police acknowledgement where required, and the prescribed fee.",
  },
  {
    icon: Landmark,
    title: "Hypothecation add / remove",
    body: "Entry of a lender's name when a vehicle is financed, and removal with the NOC and Form 35 once the loan is closed — the step most sellers forget before a sale.",
  },
  {
    icon: BadgeCheck,
    title: "Address change",
    body: "Update the address printed on the RC after a move, with proof of the new address and the prescribed form.",
  },
  {
    icon: ShieldCheck,
    title: "Fitness, permits & paperwork checks",
    body: "Guidance on fitness renewal and commercial permits for taxis, buses and goods vehicles, plus a document check before you buy a used commercial vehicle.",
  },
];

const DOCUMENTS = [
  "Original RC and a clear photocopy",
  "Valid insurance policy and PUC certificate",
  "Seller's PAN, Aadhaar and passport-size photographs",
  "Buyer's PAN, Aadhaar, address proof and photographs",
  "Form 29 and Form 30, signed by both parties",
  "Loan NOC and Form 35, if the vehicle was financed",
  "For NOC: the reason for transfer and the destination state",
];

function Page() {
  return (
    <InfoPage
      eyebrow="Services"
      title="RTO services"
      lead="Paperwork is the part of buying and selling that people dread. Our RTO desk in Indore handles RC transfer, NOC, duplicate RC, address change and hypothecation work — you sign once, we do the running."
      meta={
        <>
          <span className="mw-info-chip">
            <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Typical transfer: 15–30 days
          </span>
          <span className="mw-info-chip">Indore RTO · Madhya Pradesh</span>
        </>
      }
    >
      <InfoPanel
        title="What we handle"
        subtitle="Each job is quoted before we start, so there are no surprise charges."
        icon={<ClipboardList className="h-4 w-4" />}
      >
        <div className="mw-info-feature-grid">
          {SERVICES.map((service) => (
            <div key={service.title} className="mw-info-feature">
              <span className="mw-info-feature-icon">
                <service.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3>{service.title}</h3>
              <p>{service.body}</p>
            </div>
          ))}
        </div>
      </InfoPanel>

      <InfoPanel title="How the process runs" icon={<RefreshCcw className="h-4 w-4" />}>
        <ol className="mw-info-steps">
          <li>
            <strong>Share the documents</strong>
            Send clear photos or scans of the RC, insurance, PUC and both parties&apos; ID and
            address proof. We tell you the same day if anything is missing.
          </li>
          <li>
            <strong>We prepare and verify the file</strong>
            Forms are filled, signatures collected and the fee is confirmed in writing before
            submission.
          </li>
          <li>
            <strong>Filing at the RTO</strong>
            The application is submitted at the regional transport office and the vehicle may be
            called for inspection — we tell you the date and what to bring.
          </li>
          <li>
            <strong>New RC issued</strong>
            You receive the updated RC, and we confirm the record online so you can check it
            yourself on the transport department portal.
          </li>
        </ol>
        <div className="mw-info-note mt-4">
          Government fees and RTO timelines are set by the transport office, not by us. We file
          correctly and follow up, and we will always tell you the honest estimate rather than a
          date we cannot control.
        </div>
      </InfoPanel>

      <InfoPanel title="Documents to keep ready">
        <InfoChecks items={DOCUMENTS} />
        <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
          A signature mismatch or an expired insurance policy is the most common reason a transfer
          file comes back. Send us the documents before you commit to a sale date and we will check
          them first.
        </p>
      </InfoPanel>

      <InfoPanel title="Talk to the RTO desk">
        <div className="mw-info-prose">
          <p>
            Tell us the vehicle, the two parties and the work you need — transfer, NOC, duplicate
            RC, address change or hypothecation. We will reply with the document list, the fee and a
            realistic timeline.
          </p>
        </div>
        <div className="mw-info-btn-row">
          <Link to="/contact" className="mw-info-btn mw-info-btn--primary">
            Contact us
          </Link>
          <a href={PHONE_HREF} className="mw-info-btn mw-info-btn--ghost">
            Call {PHONE_DISPLAY}
          </a>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
