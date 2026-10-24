import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, IndianRupee, Tag, X } from "lucide-react";
import { buyListingName, rupees, type BuyListing } from "@/lib/buy-catalog";
import { saveOffer, type ListingOffer } from "@/lib/listing-offers";

/**
 * Section F — Make an Offer.
 *
 * Works on every listing card and on the detail page. The offer is validated
 * and saved against the correct vehicle in this project's local offer store
 * (localStorage) plus the lead queue. There is no seller-side offer backend
 * yet, so the dialog never claims a seller received or accepted the offer —
 * it states the missing dependency and keeps the status at "Pending".
 */
export function MakeOfferDialog({
  listing,
  open,
  onClose,
}: {
  listing: BuyListing;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<ListingOffer | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const vehicleName = buyListingName(listing);
  const askingRupees = Math.round(listing.priceLakh * 100000);
  const askingLabel = rupees(askingRupees);

  const reset = () => {
    setAmount("");
    setMessage("");
    setName("");
    setMobile("");
    setError("");
    setSaved(null);
    setBusy(false);
  };

  const close = () => {
    onClose();
    // Clear only after the panel is dismissed so the success view stays readable.
    window.setTimeout(reset, 200);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const parsed = Number(String(amount).replace(/[, ₹]/g, ""));
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid offer amount in rupees — it must be a positive number.");
      return;
    }
    if (parsed > 100000000) {
      setError("That offer looks too large. Enter the amount in rupees (for example 525000).");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your name so the team can match the offer to you.");
      return;
    }
    if (!/^[0-9+ ]{10,15}$/.test(mobile.trim())) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await saveOffer({
      listingId: listing.id,
      listingName: vehicleName,
      categoryLabel: listing.categoryLabel,
      city: listing.city,
      askingLakh: listing.priceLakh,
      amount: parsed,
      message,
      name,
      mobile,
    });

    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    setSaved(result.offer);
  };

  return (
    <div className="buy-modal" role="dialog" aria-modal="true" aria-label="Make an offer">
      <div className="buy-modal-backdrop" onClick={close} />
      <div className="buy-modal-panel">
        <div className="buy-modal-head">
          <div>
            <p className="buy-modal-kicker">Make an offer</p>
            <p className="buy-modal-title">{vehicleName}</p>
            <p className="buy-modal-sub">
              {listing.categoryLabel} · {listing.city}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close offer form"
            className="buy-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {saved ? (
          <div className="buy-offer-done" data-testid="offer-success">
            <div className="buy-offer-vehicle">
              <img
                src={listing.images[0]}
                alt={listing.photoAlt}
                width={96}
                height={64}
                loading="lazy"
              />
              <div>
                <p className="buy-offer-vehicle-name">{vehicleName}</p>
                <p className="buy-offer-vehicle-price">Asking: {askingLabel}</p>
              </div>
            </div>

            <p className="buy-offer-saved-title">
              <BadgeCheck size={18} aria-hidden="true" /> Offer saved — status Pending
            </p>
            <p className="buy-offer-saved-amount">
              Your offer: <strong>{rupees(saved.amount)}</strong>
            </p>

            <div className="buy-chat-notice">
              <strong>No seller offer backend is connected yet.</strong>                <p>
                  This offer is stored on this device (and in this project&apos;s local lead queue)
                  against {vehicleName}. It has <em>not</em> been transmitted to a seller, no one has
                  accepted or rejected it, and the asking price stays {askingLabel}. Accepted,
                  Rejected and Counter statuses only appear once seller-side tooling exists. For a
                  real response now, use Call or WhatsApp below.
                </p>
            </div>

            <div className="buy-chat-actions">
              <a
                href={`https://wa.me/919999999999?text=${encodeURIComponent(
                  `Hello MOTOR WALLAH, I would like to offer ${rupees(saved.amount)} for the ${vehicleName} listed in ${listing.city}. Asking price: ${askingLabel}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="buy-chat-action buy-chat-action--primary"
              >
                Send offer on WhatsApp
              </a>
              <button type="button" onClick={close} className="buy-chat-action">
                Done
              </button>
              <Link to="/buy/offers" className="buy-chat-action">
                Track my offers
              </Link>
            </div>
          </div>
        ) : (
          <form className="buy-offer-form" onSubmit={submit} noValidate>
            <div className="buy-offer-vehicle">
              <img
                src={listing.images[0]}
                alt={listing.photoAlt}
                width={96}
                height={64}
                loading="lazy"
              />
              <div>
                <p className="buy-offer-vehicle-name">{vehicleName}</p>
                <p className="buy-offer-vehicle-price">Asking: {askingLabel}</p>
              </div>
            </div>

            <label className="buy-field">
              <span className="buy-field-label">Your offer amount (₹) *</span>
              <span className="buy-offer-input">
                <IndianRupee size={14} aria-hidden="true" />
                <input
                  type="text"
                  inputMode="numeric"
                  name="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={String(askingRupees - 25000)}
                  autoComplete="off"
                  required
                />
              </span>
              <span className="buy-field-hint">
                Must be a positive amount in rupees. The asking price is {rupees(askingRupees)} and
                will not change.
              </span>
            </label>

            <label className="buy-field">
              <span className="buy-field-label">Message (optional)</span>
              <textarea
                name="message"
                rows={2}
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Condition, documents, timing…"
                className="buy-field-select buy-field-textarea"
              />
            </label>

            <div className="buy-offer-person">
              <label className="buy-field">
                <span className="buy-field-label">Your name *</span>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  required
                  className="buy-field-select"
                />
              </label>
              <label className="buy-field">
                <span className="buy-field-label">Mobile number *</span>
                <input
                  type="tel"
                  name="mobile"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  maxLength={15}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="buy-field-select"
                />
              </label>
            </div>

            {error && (
              <p className="buy-offer-error" role="alert">
                {error}
              </p>
            )}

            <p className="buy-field-hint">
              <Tag size={11} aria-hidden="true" /> The offer is saved on this device with status
              <strong> Pending</strong>. A seller-side accept / reject / counter system is not
              connected to this project yet, so no seller is notified automatically.
            </p>

            <button type="submit" className="buy-primary-button" disabled={busy}>
              {busy ? "Saving offer…" : "Submit offer"}
            </button>
            <button type="button" onClick={close} className="buy-secondary-button buy-offer-cancel">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
