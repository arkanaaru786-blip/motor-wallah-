import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCcw, PackageCheck, Wrench, Clock, CircleHelp } from "lucide-react";
import { InfoPage, InfoPanel, InfoChecks } from "@/components/site/InfoPage";
import { PHONE_DISPLAY, PHONE_HREF, SUPPORT_EMAIL } from "@/lib/site";

const TITLE = "Refund & Cancellation Policy | Motor Wallah";
const DESCRIPTION =
  "How returns, cancellations and refunds work at Motor Wallah — parts and decor returns, service cancellations, booking amounts and the timelines you can expect.";

export const Route = createFileRoute("/refund")({
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
      title="Refund & Cancellation Policy"
      lead="Parts, accessories and services are handled differently, so the rules below are separated by what you bought. Where a product is faulty or a service was not delivered as agreed, we make it right."
      updated="8 November 2026"
      meta={
        <>
          <span className="mw-info-chip">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Refunds in 5–7 working days
          </span>
          <span className="mw-info-chip">
            <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" /> 7-day parts returns
          </span>
        </>
      }
    >
      <InfoPanel title="Parts & decor returns" icon={<PackageCheck className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            Unused parts, accessories and decor items can be returned within{" "}
            <strong>7 days of delivery</strong> if they are in original packaging with tags, manuals
            and fitting hardware intact, and you have the invoice or order reference.
          </p>
          <p>These items cannot be returned once fitted, cut, painted or used:</p>
          <ul>
            <li>electrical and electronic items — lighting kits, cameras, audio, sensors;</li>
            <li>custom-stitched covers, mats and trims made to your specification;</li>
            <li>fluids, adhesives, paints and cleaning consumables once opened;</li>
            <li>special-order parts brought in specifically for your vehicle.</li>
          </ul>
          <p>
            If an item arrives damaged, is the wrong part, or does not fit the vehicle it was sold
            for, tell us within 48 hours with photographs. We collect the item at our cost and
            replace it or refund it in full.
          </p>
        </div>
      </InfoPanel>

      <InfoPanel title="Order cancellation" icon={<RefreshCcw className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            Orders can be cancelled free of charge any time before they are marked{" "}
            <strong>Packed</strong> in your order tracking. Once an order has shipped, the return
            rules above apply instead of cancellation.
          </p>
          <ul>
            <li>Cancelled before packing — full refund, including any delivery fee.</li>
            <li>
              Cancelled after packing but before dispatch — refund minus the actual packing and
              handling cost, which we tell you before processing.
            </li>
            <li>
              Returned after delivery — refund of the item value once the item is received and
              checked; return shipping is at your cost unless the fault was ours.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel title="Service cancellations" icon={<Wrench className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <ul>
            <li>
              Workshop, detailing, decor fitting and inspection slots can be rescheduled or
              cancelled free of charge up to <strong>12 hours before</strong> the booked time.
            </li>
            <li>
              Cancelled later than that, or if the vehicle is not available at the slot, a slot fee
              of up to 20% of the booking value may be retained to cover the reserved bay and team.
            </li>
            <li>
              Work already carried out is chargeable at the agreed estimate, even if you decide not
              to continue with the remaining jobs.
            </li>
            <li>
              If we cannot complete a job we accepted — a part is unavailable, or the work needs a
              specialist we do not have — you pay nothing for that job and any advance is refunded
              in full.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel title="Booking amounts, finance and inspection fees">
        <div className="mw-info-prose">
          <ul>
            <li>
              A vehicle booking amount is adjusted against the final price. If the sale does not
              complete because of a defect we failed to disclose, it is refunded in full.
            </li>
            <li>
              If you withdraw after documents have been prepared or RTO work has begun, the booking
              amount is refunded less the documented third-party costs already incurred.
            </li>
            <li>
              Inspection and valuation fees cover work already performed and are not refundable once
              the report is issued. The fee is adjusted against the price if you buy that vehicle
              from us.
            </li>
            <li>
              Finance and insurance fees charged by a bank, NBFC or insurer follow that
              institution&apos;s own cancellation rules; we help you file the request.
            </li>
          </ul>
        </div>
      </InfoPanel>

      <InfoPanel title="How a refund is processed" icon={<CircleHelp className="h-4 w-4" />}>
        <div className="mw-info-prose">
          <p>
            To start a return or cancellation, send us the order reference or booking ID with a
            short note:
          </p>
          <div className="mw-info-feature-grid">
            <div className="mw-info-feature">
              <h3>1. Tell us</h3>
              <p>
                Call <a href={PHONE_HREF}>{PHONE_DISPLAY}</a> or email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within the window above.
              </p>
            </div>
            <div className="mw-info-feature">
              <h3>2. We confirm</h3>
              <p>
                We acknowledge the request and share pickup or drop-off instructions in writing.
              </p>
            </div>
            <div className="mw-info-feature">
              <h3>3. We verify</h3>
              <p>The item or job is checked against the invoice, condition and fitting notes.</p>
            </div>
            <div className="mw-info-feature">
              <h3>4. You are paid</h3>
              <p>
                Approved refunds reach the original payment method in 5–7 working days; bank
                processing can add a day or two.
              </p>
            </div>
          </div>
          <InfoChecks
            items={[
              "Refunds go back to the original payment method — cash, UPI, card or the lender's account.",
              "We share a refund reference once it is initiated, so you can follow it up.",
              "Nothing in this policy reduces rights you have under the Consumer Protection Act, 2019.",
            ]}
          />
          <p>
            For anything unclear, our team can walk you through the options before you commit — see{" "}
            <Link to="/contact">contact us</Link> or the <Link to="/faqs">FAQs</Link>.
          </p>
        </div>
      </InfoPanel>
    </InfoPage>
  );
}
