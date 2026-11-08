import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { InfoPage, InfoPanel } from "@/components/site/InfoPage";
import { ContactForm } from "@/components/site/InfoForms";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL, WHATSAPP } from "@/lib/site";

const TITLE = "Contact Motor Wallah | Indore, Madhya Pradesh";
const DESCRIPTION =
  "Call 9691938533, WhatsApp or email care@motorwallah.in. Motor Wallah is in Indore, Madhya Pradesh — reach the team for buying, selling, service, parts, finance, insurance or RTO help.";

export const Route = createFileRoute("/contact")({
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

const MAPS = "https://www.google.com/maps/search/?api=1&query=Motor%20Wallah%20Indore";

function Page() {
  return (
    <InfoPage
      eyebrow="Support"
      title="Contact us"
      lead="One team for buying, selling, service, parts, finance, insurance and RTO paperwork. Call, message or send the form below — we reply within one working day."
      meta={
        <>
          <span className="mw-info-chip">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Indore, Madhya Pradesh
          </span>
          <span className="mw-info-chip">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Mon–Sat, 9:30 am – 7:00 pm
          </span>
        </>
      }
    >
      <InfoPanel
        title="Reach the team"
        subtitle="Pick whichever is easiest — the same people answer all three."
      >
        <div className="mw-info-tiles">
          <a className="mw-info-tile" href={PHONE_HREF}>
            <span className="mw-info-tile-icon">
              <Phone className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="mw-info-tile-label">Call us</span>
              <span className="mw-info-tile-value">{PHONE_DISPLAY}</span>
              <small>Sales, service and support · Mon–Sat</small>
            </span>
          </a>
          <a className="mw-info-tile" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
            <span className="mw-info-tile-icon">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="mw-info-tile-label">WhatsApp</span>
              <span className="mw-info-tile-value">Chat with us</span>
              <small>Photos of a vehicle or part welcome</small>
            </span>
          </a>
          <a className="mw-info-tile" href={`mailto:${SUPPORT_EMAIL}`}>
            <span className="mw-info-tile-icon">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="mw-info-tile-label">Email</span>
              <span className="mw-info-tile-value">{SUPPORT_EMAIL}</span>
              <small>Documents, invoices and written queries</small>
            </span>
          </a>
          <a className="mw-info-tile" href={MAPS} target="_blank" rel="noopener noreferrer">
            <span className="mw-info-tile-icon">
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="mw-info-tile-label">Visit us</span>
              <span className="mw-info-tile-value">Motor Wallah, Indore</span>
              <small>
                Madhya Pradesh, India — workshop and delivery address is shared with your booking
                confirmation.
              </small>
            </span>
          </a>
        </div>
      </InfoPanel>

      <InfoPanel
        title="Send a message"
        subtitle="Tell us the vehicle, order or paperwork you need help with."
        icon={<Send className="h-4 w-4" />}
      >
        <ContactForm />
      </InfoPanel>

      <InfoPanel title="What happens after you write in">
        <ol className="mw-info-steps">
          <li>
            <strong>We read it and call you</strong>
            Usually within one working day. If it is urgent — a breakdown, a delivery delay or a
            payment problem — call us instead of waiting.
          </li>
          <li>
            <strong>We name the owner of your request</strong>
            Buying, workshop, parts, finance, insurance and RTO each have a desk, so you speak to
            someone who works on that every day.
          </li>
          <li>
            <strong>You get a reference</strong>
            Any booking, order or job card comes with a reference you can use on the{" "}
            <Link to="/track">tracking page</Link> — no need to chase for an update.
          </li>
        </ol>
        <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
          Our office is in Indore, Madhya Pradesh. We do not ask for OTPs, UPI PINs or bank
          passwords — if someone claiming to be from Motor Wallah does, stop and call the number on
          this page.
        </p>
      </InfoPanel>
    </InfoPage>
  );
}
