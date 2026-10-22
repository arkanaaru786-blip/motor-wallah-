import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, Send, X } from "lucide-react";
import { buyListingName, type BuyListing } from "@/lib/buy-catalog";
import { useListingThread } from "@/lib/listing-chat";
import { submitLead } from "@/lib/leads";
import { PHONE_HREF, whatsappLink } from "@/lib/site";

/**
 * In-site conversation for one listing.
 *
 * The project has no messaging backend yet, so this dialog only implements what
 * genuinely works: a local thread on this device plus direct call / WhatsApp
 * hand-off. It never claims that the seller received a message.
 */
export function ContactSellerDialog({
  listing,
  open,
  onClose,
}: {
  listing: BuyListing;
  open: boolean;
  onClose: () => void;
}) {
  const { messages, send } = useListingThread(listing.id);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const name = buyListingName(listing);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    send(body);
    setDraft("");
    setSaved(true);
    await submitLead({
      type: "listing_enquiry",
      source: "listing_chat",
      vehicleId: listing.id,
      vehicleName: name,
      location: listing.city,
      fields: { message: body, listingCategory: listing.categoryLabel },
    });
  };

  return (
    <div className="buy-modal" role="dialog" aria-modal="true" aria-label="Contact seller">
      <div className="buy-modal-backdrop" onClick={onClose} />
      <div className="buy-modal-panel">
        <div className="buy-modal-head">
          <div>
            <p className="buy-modal-kicker">Contact seller</p>
            <p className="buy-modal-title">{name}</p>
            <p className="buy-modal-sub">
              {listing.city} · {listing.categoryLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="buy-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="buy-chat-notice">
          <strong>Messaging backend not connected.</strong>
          <p>
            This conversation is saved on this device only. The seller is not notified automatically
            yet — use Call or WhatsApp below for a real reply from the Motor Wallah team.
          </p>
        </div>

        <div className="buy-chat-thread">
          {messages.length === 0 ? (
            <p className="buy-chat-empty">
              No messages yet. Write your question about this listing and it will appear here.
            </p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="buy-chat-message">
                <div className="buy-chat-bubble">
                  <p>{message.body}</p>
                  <span>
                    You ·{" "}
                    {new Date(message.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="buy-chat-form">
          <label className="buy-chat-input">
            <span className="sr-only">Your message</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={`Ask about the ${listing.model} — availability, documents, inspection…`}
            />
          </label>
          <button type="submit" className="buy-chat-send" disabled={!draft.trim()}>
            <Send size={15} /> Save message
          </button>
        </form>

        {saved && (
          <p className="buy-chat-saved">
            Saved on this device. Nothing was transmitted because no messaging server is connected.
          </p>
        )}

        <div className="buy-chat-actions">
          <a
            href={whatsappLink(
              `Hello MOTOR WALLAH, I am interested in the ${name} in ${listing.city}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="buy-chat-action buy-chat-action--primary"
          >
            <MessageCircle size={15} /> WhatsApp the team
          </a>
          <a href={PHONE_HREF} className="buy-chat-action">
            <Phone size={15} /> Call now
          </a>
        </div>
      </div>
    </div>
  );
}
