import { MessageCircle, Phone, ShieldCheck, X } from "lucide-react";
import { buyListingName, rupees, type BuyListing } from "@/lib/buy-catalog";
import { ChatThreadView, BUYER_QUICK_REPLIES } from "@/components/chat/ChatThreadView";
import { submitLead } from "@/lib/leads";
import { PHONE_HREF, whatsappLink } from "@/lib/site";

/**
 * Vehicle chat — the buyer's side of the conversation.
 *
 * Messages are stored in this browser (see src/lib/listing-chat.ts) so the
 * seller can read and answer the same thread from the Seller Desk. A seller
 * reply is simulated three seconds after each buyer message.
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
  if (!open) return null;

  const vehicle = buyListingName(listing);
  const price = rupees(Math.round(listing.priceLakh * 100000));
  const seller = `${listing.model} Seller`;

  return (
    <div
      className="buy-modal mw-chat-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with the ${vehicle} seller`}
    >
      <div className="buy-modal-backdrop" onClick={onClose} />
      <div className="buy-modal-panel buy-modal-panel--chat mw-chat-panel">
        <header className="mw-chat-head">
          <span className="mw-chat-avatar" aria-hidden="true">
            <img src={listing.images[0]} alt="" width={96} height={64} />
          </span>
          <span className="mw-chat-head-text">
            <span className="mw-chat-head-title" data-testid="chat-title">
              Chatting with {seller}
            </span>
            <span className="mw-chat-head-sub">
              {vehicle} · {price}
            </span>
            <span className="mw-chat-head-status">
              <i aria-hidden="true" /> Online · replies in a few seconds
            </span>
          </span>
          <a
            href={PHONE_HREF}
            className="mw-chat-head-action"
            aria-label="Call the Motor Wallah desk"
          >
            <Phone size={15} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="mw-chat-close"
            data-testid="chat-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="mw-chat-body">
          <p className="mw-chat-banner">
            <ShieldCheck size={13} aria-hidden="true" />
            Enquiries for this listing are saved to your dashboard.
          </p>

          <ChatThreadView
            listing={listing}
            role="buyer"
            quickReplies={BUYER_QUICK_REPLIES}
            onFirstMessage={(body) => {
              void submitLead({
                type: "listing_enquiry",
                source: "listing_chat",
                vehicleId: listing.id,
                vehicleName: vehicle,
                location: listing.city,
                fields: { message: body, listingCategory: listing.categoryLabel },
              });
            }}
          />
        </div>

        <footer className="mw-chat-foot">
          <a href={PHONE_HREF} className="mw-chat-foot-link">
            <Phone size={14} aria-hidden="true" /> Call
          </a>
          <a
            href={whatsappLink(
              `Hello MOTOR WALLAH, I am interested in the ${vehicle} in ${listing.city}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mw-chat-foot-link mw-chat-foot-link--wa"
          >
            <MessageCircle size={14} aria-hidden="true" /> WhatsApp
          </a>
          <span className="mw-chat-foot-note">Demo chat · stored in this browser</span>
        </footer>
      </div>
    </div>
  );
}
