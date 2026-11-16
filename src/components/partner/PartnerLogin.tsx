import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Wrench } from "lucide-react";

import {
  PARTNER_TYPES,
  ensurePartners,
  getPartnerType,
  listPartnersOfType,
  type Partner,
  type PartnerType,
} from "@/lib/partners";
import { signInPartner, usePartnerSession } from "@/lib/partner-session";

/**
 * ID + password gate shared by the workshop, parts and decor portals. The ID
 * carries the partner type, so the same form on another portal cannot open an
 * account of a different type.
 */
export function PartnerLogin({ type }: { type: PartnerType }) {
  const def = getPartnerType(type);
  const { ready, session } = usePartnerSession(type);
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensurePartners();
  }, []);

  useEffect(() => {
    if (ready && session) void navigate({ to: def.portalPath, replace: true });
  }, [ready, session, navigate, def.portalPath]);

  return (
    <div className="mw-dealer mw-dealer-login mw-partner mw-partner-login" data-partner-type={type}>
      <div className="mw-dealer-login-card">
        <div className="mw-dealer-login-main">
          <div className="mw-dealer-brand">
            <span className="mw-dealer-brand-mark" aria-hidden="true">
              <Wrench size={19} />
            </span>
            <div>
              <strong>Motor Wallah {def.label} Portal</strong>
              <span>{def.blurb}</span>
            </div>
          </div>

          <div>
            <h1>{def.label} partner sign in</h1>
            <p className="mw-dealer-login-lede">
              Use the portal ID and password issued by Motor Wallah. This portal opens{" "}
              {type === "workshop"
                ? "the job cards assigned to your workshop"
                : `the ${type === "parts" ? "auto parts" : "decor"} orders and stock for your shop`}{" "}
              only.
            </p>
          </div>

          <form
            className="mw-dealer-form"
            style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setBusy(true);
              const result = await signInPartner(type, partnerId, password);
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              void navigate({ to: def.portalPath });
            }}
            data-testid={`${type}-login-form`}
          >
            <label className="mw-dealer-field">
              <span>{def.label} portal ID</span>
              <input
                value={partnerId}
                onChange={(event) => setPartnerId(event.target.value.toUpperCase())}
                placeholder={def.idPlaceholder}
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                className="mw-partner-id-input"
                required
                data-testid={`${type}-login-id`}
              />
            </label>

            <label className="mw-dealer-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                data-testid={`${type}-login-password`}
              />
            </label>

            {error ? (
              <p className="mw-dealer-error" role="alert" data-testid={`${type}-login-error`}>
                {error}
              </p>
            ) : null}

            <div className="mw-dealer-form-actions">
              <button
                type="submit"
                className="mw-dealer-btn is-primary"
                disabled={busy}
                data-testid={`${type}-login-submit`}
              >
                <KeyRound size={15} /> {busy ? "Checking…" : "Sign in"}
              </button>
              <Link to="/book-service" className="mw-dealer-link">
                Need car care instead? <ArrowRight size={13} />
              </Link>
            </div>
          </form>
        </div>

        <aside className="mw-dealer-login-aside">
          <h2>{def.label} partner access</h2>
          <p className="mw-dealer-demo-note">
            Your portal ID and password are issued by the Motor Wallah team. If you have lost them,
            contact the control room to have the password reset — the ID never changes.
          </p>
          <p className="mw-dealer-demo-note">
            A partner ID only works on its own portal, so a workshop login cannot open parts or
            decor records.
          </p>

          <div className="mw-partner-switcher">
            <span>Other partner portals</span>
            <div>
              {PARTNER_TYPES.filter((item) => item.id !== type).map((item) => (
                <Link key={item.id} to={item.loginPath}>
                  {item.label}
                </Link>
              ))}
              <Link to="/dealer-login">Dealer</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
