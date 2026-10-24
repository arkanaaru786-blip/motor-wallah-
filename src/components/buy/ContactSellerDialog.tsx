import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, Send, X } from "lucide-react";
import { rupees, type BuyListing } from "@/lib/buy-catalog";
import { useListingThread } from "@/lib/listing-chat";
import { submitLead } from "@/lib/leads";
import { PHONE_HREF, whatsappLink } from "@/lib/site";

/**
 * Reference screen 9 — in-site conversation for one listing.
 *
 * The project has no messaging backend yet, so this dialog only implements what
 * genuinely works: a local thread on this device (buyer messages on the right,
 * the system notice on the left) plus direct call / WhatsApp hand-off. It never
 * claims that the seller received or replied to a message.
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
  const name = [listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
  const price = rupees(Math.round(listing.priceLakh * 100000));

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
    <div className="buy-modal" role="dialog" aria-modal="true" aria-label="Chat with seller">
      <div className="buy-modal-backdrop" onClick={onClose} />
      <div className="buy-modal-panel buy-modal-panel--chat">
        <div className="buy-chat-head">
          <span className="buy-chat-thumb">
            <img src={listing.images[0]} alt="" aria-hidden="true" width={72} height={48} />
          </span>
          <div className="buy-chat-head-text">
            <p className="buy-chat-head-title">Chat with Seller</p>
            <p className="buy-chat-head-sub">
              {name} · {price}
            </p>
            <p className="buy-chat-head-status">
              <i aria-hidden="true" /> Seller not connected — local demo thread
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

        <div className="buy-chat-thread" data-testid="chat-thread">
          <div className="buy-chat-message buy-chat-message--system">
            <div className="buy-chat-bubble buy-chat-bubble--system">
              <p>
                Messaging backend not connected: this conversation is saved on this device only.
                The seller is not notified automatically — use Call or WhatsApp below for a real
                reply from the Motor Wallah team.
              </p>
              <span>System · {listing.city}</span>
            </div>
          </div>

          {messages.map((message) => (
            <div key={message.id} className="buy-chat-message buy-chat-message--me">
              <div className="buy-chat-bubble buy-chat-bubble--me">
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
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="buy-chat-form">
          <label className="buy-chat-input">
            <span className="sr-only">Your message</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Type a message…"
            />
          </label>
          <button type="submit" className="buy-chat-send" disabled={!draft.trim()}>
            <Send size={15} /> Send
          </button>
        </form>

        {saved && (
          <p className="buy-chat-saved">
            Saved on this device. Nothing was transmitted because no messaging server is connected.
          </p>
        )}

        <div className="buy-chat-actions">
          <a href={PHONE_HREF} className="buy-chat-action">
            <Phone size={15} /> Call
          </a>
          <a
            href={whatsappLink(
              `Hello MOTOR WALLAH, I am interested in the ${name} in ${listing.city}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="buy-chat-action buy-chat-action--whatsapp"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
