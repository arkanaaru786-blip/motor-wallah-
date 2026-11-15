import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ShieldCheck, X } from "lucide-react";
import type { Banner } from "@/lib/banners";
import { bannerHref } from "@/lib/banners";
import { notifyAdvertiser, sectionLabel, submitAdLead } from "@/lib/ad-leads";

/**
 * The enquiry form a visitor sees when they click an advertisement.
 *
 * The form is deliberately short — name, mobile, requirement — because it sits
 * between the visitor and the advertiser's site. The lead is stored first; the
 * advertiser notification is then fired off without blocking the confirmation.
 */

type State = "idle" | "busy" | "done";

function AdLeadDialog({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [requirement, setRequirement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");

  // A new ad starts a fresh form; a closed dialog forgets the last visitor.
  useEffect(() => {
    setName("");
    setMobile("");
    setRequirement("");
    setError(null);
    setState("idle");
  }, [banner?.id]);

  useEffect(() => {
    if (!banner) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [banner, onClose]);

  if (!banner) return null;

  const target = bannerHref(banner);
  const label = sectionLabel(banner.section);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!banner || state === "busy") return;

    const cleanName = name.trim();
    const cleanMobile = mobile.trim();
    const cleanRequirement = requirement.trim();

    if (cleanName.length < 2) {
      setError("Please enter your name so the advertiser knows who to ask for.");
      return;
    }
    if (
      !/^\+?[0-9][0-9\s-]{8,14}$/.test(cleanMobile) ||
      cleanMobile.replace(/\D/g, "").length < 10
    ) {
      setError("Please enter a valid mobile number with at least 10 digits.");
      return;
    }
    if (cleanRequirement.length < 3) {
      setError("Tell the advertiser what you need — even a short line helps.");
      return;
    }

    setError(null);
    setState("busy");
    const saved = await submitAdLead({
      banner,
      name: cleanName,
      mobile: cleanMobile,
      requirement: cleanRequirement,
      sourcePath: window.location.pathname + window.location.search,
    });

    if (!saved.ok) {
      setError(saved.error ?? "Could not send your enquiry. Please try again.");
      setState("idle");
      return;
    }

    void notifyAdvertiser({
      banner,
      name: cleanName,
      mobile: cleanMobile,
      requirement: cleanRequirement,
      sourcePath: window.location.pathname + window.location.search,
    });
    setState("done");
  }

  // The dialog is portalled to <body>: ad cards use backdrop-filter and
  // overflow:hidden, which would otherwise trap a fixed overlay inside the
  // 165px sidebar column (or any other transformed/ad container).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="buy-modal mw-adlead"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mw-adlead-title"
      data-testid="ad-lead-dialog"
    >
      <div className="buy-modal-backdrop" onClick={onClose} />
      <div className="buy-modal-panel">
        <div className="buy-modal-head">
          <div>
            <p className="buy-modal-kicker">Advertisement enquiry</p>
            <p className="buy-modal-title" id="mw-adlead-title">
              {banner.title.trim() || "Tell the advertiser what you need"}
            </p>
            <p className="buy-modal-sub">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close enquiry form"
            className="buy-modal-close"
            data-testid="ad-lead-close"
          >
            <X size={18} />
          </button>
        </div>

        {state === "done" ? (
          <div className="mw-adlead-done" data-testid="ad-lead-success">
            <p className="mw-adlead-done-title">
              <CheckCircle2 size={18} aria-hidden="true" /> Enquiry sent
            </p>
            <p className="mw-adlead-done-text">
              Your details are with {banner.advertiserName.trim() || "the advertiser"}. They will
              contact you on <strong>{mobile.trim()}</strong> about your requirement.
            </p>
            <div className="mw-adlead-done-actions">
              {target ? (
                <a
                  className="buy-primary-button"
                  href={target}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  data-testid="ad-lead-continue"
                >
                  Continue to advertiser
                </a>
              ) : null}
              <button type="button" className="buy-secondary-button" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="mw-adlead-form" onSubmit={submit} noValidate>
            <label className="buy-field">
              <span className="buy-field-label">Your name *</span>
              <input
                type="text"
                name="name"
                className="buy-field-select"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoComplete="name"
                placeholder="Full name"
                required
                autoFocus
                data-testid="ad-lead-name"
              />
            </label>

            <label className="buy-field">
              <span className="buy-field-label">Mobile number *</span>
              <input
                type="tel"
                name="mobile"
                className="buy-field-select"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                maxLength={16}
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile with WhatsApp"
                required
                data-testid="ad-lead-mobile"
              />
            </label>

            <label className="buy-field">
              <span className="buy-field-label">Your requirement *</span>
              <textarea
                name="requirement"
                className="buy-field-select buy-field-textarea"
                value={requirement}
                onChange={(event) => setRequirement(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="What are you looking for? Budget, model, service or timing…"
                required
                data-testid="ad-lead-requirement"
              />
            </label>

            {error ? (
              <p className="buy-offer-error" role="alert" data-testid="ad-lead-error">
                {error}
              </p>
            ) : null}

            <p className="mw-adlead-privacy">
              <ShieldCheck size={13} aria-hidden="true" /> Shared only with this advertiser so they
              can respond to your enquiry.
            </p>

            <button
              type="submit"
              className="buy-primary-button"
              disabled={state === "busy"}
              data-testid="ad-lead-submit"
            >
              {state === "busy" ? "Sending enquiry…" : "Send enquiry"}
            </button>
            <button type="button" className="buy-secondary-button" onClick={onClose}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * State + markup for an ad's enquiry form. Each ad surface uses this so the
 * popup is defined once and the artwork stays a plain link.
 */
export function useAdLeadDialog() {
  const [banner, setBanner] = useState<Banner | null>(null);
  return {
    captureAdLead: (entry: Banner) => setBanner(entry),
    adLeadDialog: <AdLeadDialog banner={banner} onClose={() => setBanner(null)} />,
  };
}

export { AdLeadDialog };
