import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck, Wrench } from "lucide-react";

import {
  DEMO_PARTNER_PASSWORD,
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
  const [demoAccounts, setDemoAccounts] = useState<Partner[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensurePartners().then(() => {
      if (cancelled) return;
      const account = listPartnersOfType(type).find(
        (partner) => partner.id === `${def.prefix}-${def.startAt}`,
      );
      setDemoAccounts(account ? [account] : []);
    });
    return () => {
      cancelled = true;
    };
  }, [type, def.prefix, def.startAt]);

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
          <h2>Demo {def.label.toLowerCase()} login</h2>
          <p className="mw-dealer-demo-note">
            This demo account is created for the mock setup. Click it to fill the form — the
            password is <code>{DEMO_PARTNER_PASSWORD}</code>.
          </p>
          <ul className="mw-dealer-demo-list">
            {demoAccounts.map((partner) => (
              <li key={partner.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPartnerId(partner.id);
                    setPassword(DEMO_PARTNER_PASSWORD);
                    setError(null);
                  }}
                  data-testid={`${type}-demo-account`}
                >
                  <strong className="mw-partner-id">{partner.id}</strong>
                  <span>{partner.business}</span>
                </button>
              </li>
            ))}
            {demoAccounts.length === 0 ? (
              <li className="mw-dealer-demo-note">Preparing the demo account…</li>
            ) : null}
          </ul>

          <p className="mw-dealer-demo-note">
            <ShieldCheck size={13} /> Passwords are stored as salted PBKDF2 hashes — never as
            plaintext — and a partner ID only works on its own portal.
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
