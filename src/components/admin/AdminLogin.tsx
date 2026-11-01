import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import {
  ADMIN_SOURCE_LABEL,
  enrollAdmin,
  envAdminEmail,
  signInAdmin,
  useAdminSession,
  validateNewPassword,
} from "@/lib/admin-auth";

/** Shared by the /master-admin/login route file. */
export function MasterAdminLoginPage() {
  const navigate = useNavigate();
  const { ready, session, needsSetup } = useAdminSession();
  const envEmail = envAdminEmail();

  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(envEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setup = needsSetup && mode === "setup";

  useEffect(() => {
    if (ready && session) void navigate({ to: "/master-admin", replace: true });
  }, [ready, session, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (setup) {
      const passwordError = validateNewPassword(password, confirm);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setBusy(true);
    try {
      const result = setup
        ? await enrollAdmin({ email, name, password })
        : await signInAdmin(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: "/master-admin", replace: true });
    } catch {
      setError("Sign-in could not complete. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mw-admin mw-admin-gate">
      <div className="mw-admin-gate-wrap">
        <section className="mw-admin-gate-intro">
          <span className="mw-admin-eyebrow">
            <ShieldCheck size={15} /> Master Control Room
          </span>
          <h1 className="mw-admin-gate-title">
            One console for <em>every</em> business case.
          </h1>
          <p className="mw-admin-gate-text">
            Phase 1 — foundation: secure access, the live KPI overview and the unified Master
            Tracker for finance, insurance, service, franchise, sell, scrap, parts and decor
            requests.
          </p>
          <ul className="mw-admin-gate-list">
            <li>
              <span>01</span> Email and password access, separate from customer accounts
            </li>
            <li>
              <span>02</span> No credential in the codebase — environment or hashed database only
            </li>
            <li>
              <span>03</span> Sessions expire after 8 hours or 30 idle minutes
            </li>
          </ul>
        </section>

        <section className="mw-admin-gate-card" aria-labelledby="admin-login-title">
          <div className="mw-admin-gate-cardhead">
            <div>
              <h2 id="admin-login-title">
                {setup ? "Create master admin" : "Administrator sign in"}
              </h2>
              <p>
                {setup
                  ? "No administrator exists on this device yet. Create the first account — the password is stored only as a salted hash."
                  : "Restricted area. Use your Motor Wallah administrator credentials."}
              </p>
            </div>
            <span className="mw-admin-badge">Phase 1</span>
          </div>

          {needsSetup && mode === "signin" ? (
            <div className="mw-admin-setup-hint">
              <Lock size={16} />
              <p>
                No administrator account is configured yet.{" "}
                <button
                  type="button"
                  onClick={() => setMode("setup")}
                  data-testid="admin-setup-link"
                >
                  Set up the master admin
                </button>
              </p>
            </div>
          ) : null}

          {!needsSetup && envEmail && mode === "signin" ? (
            <div className="mw-admin-env-hint">
              <ShieldCheck size={16} />
              <p>
                Credentials for <strong>{envEmail}</strong> are managed by the deployment
                environment.
              </p>
            </div>
          ) : null}

          <form className="mw-admin-form" onSubmit={handleSubmit} noValidate>
            {setup ? (
              <label className="mw-admin-field">
                <span>Full name</span>
                <div className="mw-admin-input">
                  <UserRound size={16} />
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Ananya Rao"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    data-testid="admin-name"
                  />
                </div>
              </label>
            ) : null}

            <label className="mw-admin-field">
              <span>Administrator email</span>
              <div className="mw-admin-input">
                <Mail size={16} />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="admin@motorwallah.in"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  data-testid="admin-email"
                  required
                />
              </div>
            </label>

            <label className="mw-admin-field">
              <span>Password</span>
              <div className="mw-admin-input">
                <KeyRound size={16} />
                <input
                  type="password"
                  name="password"
                  autoComplete={setup ? "new-password" : "current-password"}
                  placeholder={setup ? "At least 10 characters" : "Your password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  data-testid="admin-password"
                  required
                />
              </div>
            </label>

            {setup ? (
              <label className="mw-admin-field">
                <span>Confirm password</span>
                <div className="mw-admin-input">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Repeat the password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    data-testid="admin-confirm"
                    required
                  />
                </div>
              </label>
            ) : null}

            {error ? (
              <p className="mw-admin-error" role="alert" data-testid="admin-error">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="mw-admin-submit"
              disabled={busy}
              data-testid="admin-submit"
            >
              {busy ? "Verifying…" : setup ? "Create account & enter" : "Enter control room"}
              <ArrowRight size={17} />
            </button>
          </form>

          <div className="mw-admin-gate-foot">
            <span>
              {setup
                ? "Password rule: 10+ characters with a letter and a number."
                : `Session security: ${ADMIN_SOURCE_LABEL.environment} or ${ADMIN_SOURCE_LABEL.database.toLowerCase()}.`}
            </span>
            <a href="/">← Back to Motor Wallah</a>
          </div>
        </section>
      </div>
    </div>
  );
}
