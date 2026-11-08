import { useState } from "react";
import { Check, Copy, MessageCircle, ShieldCheck, X } from "lucide-react";

import { credentialsMessage } from "@/lib/partner-ids";

/**
 * Credentials the panel generated while creating or resetting an account.
 *
 * The plaintext password exists only in this component's props: only the PBKDF2
 * hash is stored, so this card is the one chance to copy or share it. Everything
 * here is local — nothing is posted to a third-party service; the WhatsApp link
 * opens the admin's own WhatsApp with the message prefilled.
 */
export function IssuedCredentials({
  kind,
  name,
  id,
  password,
  mobile,
  onDismiss,
}: {
  kind: "dealer" | "employee";
  name: string;
  id: string;
  password: string;
  mobile?: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const portal = kind === "dealer" ? "/dealer-login" : "/employee-login";
  const portalLabel = kind === "dealer" ? "Partner portal" : "Employee dashboard";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const message = credentialsMessage({
    recipient: name,
    id,
    password,
    portal: `${origin}${portal}`,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const whatsappHref = `https://wa.me/${mobile ? `91${mobile}` : ""}?text=${encodeURIComponent(message)}`;

  return (
    <section className="mw-authcred" data-testid="issued-credentials">
      <div className="mw-authcred-head">
        <p className="mw-authcred-title">
          <ShieldCheck size={15} /> {kind === "dealer" ? "Partner" : "Employee"} credentials ready
        </p>
        <button
          type="button"
          className="mw-admin-drawer-close"
          aria-label="Dismiss credentials"
          onClick={onDismiss}
          data-testid="issued-dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mw-authcred-grid">
        <div className="mw-authcred-field">
          <span>{kind === "dealer" ? "Partner ID" : "Employee ID"}</span>
          <strong data-testid="issued-id">{id}</strong>
        </div>
        <div className="mw-authcred-field">
          <span>Temporary password</span>
          <strong data-testid="issued-password">{password}</strong>
        </div>
      </div>

      <p className="mw-authcred-note">
        Share both values privately with {name}. Only a salted hash is stored, so this password is
        shown once — if it is lost, issue a new one from the directory.
      </p>

      <div className="mw-authcred-actions">
        <button type="button" onClick={() => void copy()} data-testid="issued-copy">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy credentials"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="issued-whatsapp"
        >
          <MessageCircle size={14} /> Share on WhatsApp
        </a>
        <span className="mw-authcred-note">
          {portalLabel}: {portal}
        </span>
      </div>
    </section>
  );
}
