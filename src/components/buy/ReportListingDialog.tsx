import { useState } from "react";
import { Flag, MessageCircle, Phone, X } from "lucide-react";
import { buyListingName, type BuyListing } from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import { PHONE_HREF, whatsappLink } from "@/lib/site";

const REASONS = [
  "Vehicle is not available",
  "Wrong or misleading photos",
  "Incorrect price or details",
  "Suspected fraud",
  "Duplicate listing",
  "Something else",
] as const;

export function ReportListingDialog({
  listing,
  open,
  onClose,
}: {
  listing: BuyListing;
  open: boolean;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  if (!open) return null;
  const name = buyListingName(listing);

  return (
    <div className="buy-modal" role="dialog" aria-modal="true" aria-label="Report listing">
      <div className="buy-modal-backdrop" onClick={onClose} />
      <div className="buy-modal-panel">
        <div className="buy-modal-head">
          <div>
            <p className="buy-modal-kicker">Report listing</p>
            <p className="buy-modal-title">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report form"
            className="buy-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="buy-report-done">
            <Flag size={22} aria-hidden="true" />
            <p className="buy-modal-title">Report saved on this device</p>
            <p className="buy-modal-sub">
              The moderation inbox is not connected to a server yet, so this report was not
              transmitted. For anything urgent, contact the team directly — those channels are live.
            </p>
            <div className="buy-chat-actions">
              <a
                href={whatsappLink(`Hello MOTOR WALLAH, I want to report the listing: ${name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="buy-chat-action buy-chat-action--primary"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
              <a href={PHONE_HREF} className="buy-chat-action">
                <Phone size={15} /> Call
              </a>
            </div>
          </div>
        ) : (
          <form
            className="buy-report-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await submitLead({
                type: "listing_report",
                source: "listing_report",
                vehicleId: listing.id,
                vehicleName: name,
                location: listing.city,
                fields: {
                  reason: String(data.get("reason") ?? ""),
                  details: String(data.get("details") ?? ""),
                },
              });
              setDone(true);
            }}
          >
            <label className="buy-field">
              <span className="buy-field-label">Reason</span>
              <select name="reason" required className="buy-field-select">
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <label className="buy-field">
              <span className="buy-field-label">Details (optional)</span>
              <textarea
                name="details"
                rows={3}
                maxLength={500}
                placeholder="Tell us what looks wrong with this listing"
                className="buy-field-select buy-field-textarea"
              />
            </label>
            <p className="buy-field-hint">
              The moderation backend is not connected yet, so reports are stored on this device
              only. Please also call or WhatsApp us for anything urgent.
            </p>
            <button type="submit" className="buy-primary-button">
              Save report
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
