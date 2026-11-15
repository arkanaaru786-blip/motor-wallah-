import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/admin-crypto";
import { staffClient } from "@/lib/staff-auth";
import { describeSupabaseError } from "@/lib/supabase";

/**
 * Password reset landing page for Supabase recovery links.
 *
 * Supabase delivers the recovery session in the URL fragment, e.g.
 *   #access_token=…&refresh_token=…&type=recovery
 *
 * The staff client keeps its own storage and is created with
 * `detectSessionInUrl: false`, so automatic URL detection is off for it. This
 * page therefore (1) subscribes to `onAuthStateChange` for a PASSWORD_RECOVERY /
 * SIGNED_IN event and (2) reads the fragment itself and calls `setSession` to
 * create the temporary recovery session. The fragment is cleared from the
 * address bar as soon as it is read.
 *
 * This route is public (no auth guard): a signed-out visitor must be able to
 * open a recovery link and reach the new-password form.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const client = staffClient();
    if (!client) {
      setStatus("invalid");
      setMessage(
        "The database is not configured for this build, so the password cannot be reset here.",
      );
      return;
    }

    let alive = true;
    let settled = false;
    let fallbackTimer: number | null = null;

    const settleReady = (userEmail: string | null) => {
      if (!alive || settled) return;
      settled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      setEmail(userEmail);
      setStatus("ready");
    };

    const settleInvalid = (text: string) => {
      if (!alive || settled) return;
      settled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      setStatus("invalid");
      setMessage(text);
    };

    // 1) Listen for Supabase auth events. A recovery link produces
    // PASSWORD_RECOVERY (and some flows emit SIGNED_IN); either means we have a
    // temporary session and may show the new-password form.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        settleReady(session.user.email ?? null);
      }
    });

    const applyFromUrl = async () => {
      // 2) Try to read the recovery token from the URL hash ourselves, since the
      // staff client does not auto-detect sessions from the URL.
      const hash = window.location.hash.replace(/^#/, "");
      const query = window.location.search.replace(/^\?/, "");

      // Prefer the fragment (implicit flow: #access_token=…&type=recovery).
      const params = new URLSearchParams(hash || query);
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") ?? "";
      const urlError = params.get("error_description") ?? params.get("error");

      const hasRecoveryPayload = type === "recovery" || !!accessToken;

      // Clear tokens from the URL as soon as we've read them so they are not
      // left in history or leaked via the referrer.
      if (hash || (query && hasRecoveryPayload)) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      if (urlError) {
        settleInvalid(decodeURIComponent(urlError.replace(/\+/g, " ")));
        return;
      }

      if (accessToken) {
        const { data, error: sessionError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!alive) return;

        if (sessionError || !data.session) {
          settleInvalid(
            sessionError
              ? `${describeSupabaseError(sessionError)} This reset link may have expired — request a new one.`
              : "This reset link could not be verified. It may have expired — request a new one.",
          );
          return;
        }

        settleReady(data.session.user.email ?? null);
        return;
      }

      // 3) No token in the URL — a session may already exist (e.g. the auth
      // listener fired, or the user refreshed mid-recovery). Accept it only when
      // it is present; otherwise fall through to the invalid timeout.
      const { data } = await client.auth.getSession();
      if (!alive) return;
      if (data.session) {
        settleReady(data.session.user.email ?? null);
      }
    };

    void applyFromUrl();

    // If neither an auth event nor a URL token yields a session, explain why
    // after a short grace period (gives onAuthStateChange time to fire).
    fallbackTimer = window.setTimeout(() => {
      settleInvalid(
        "This reset link is missing its sign-in token or has already been used. Open the most recent reset email on this device, or request a new link.",
      );
    }, 2500);

    return () => {
      alive = false;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const weak = validatePasswordStrength(password);
    if (weak) {
      setError(weak);
      return;
    }
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }

    const client = staffClient();
    if (!client) {
      setError("The database is not configured for this build.");
      return;
    }

    // Confirm the temporary recovery session is still present before updating.
    const { data } = await client.auth.getSession();
    if (!data.session) {
      setError("Your recovery session is no longer active. Open the reset link again to continue.");
      setStatus("invalid");
      setMessage(
        "This reset link has expired or was already used. Request a new reset email and try again.",
      );
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError(describeSupabaseError(updateError));
        return;
      }

      // Password saved — only now leave the recovery page.
      setStatus("done");
      setMessage("Your password has been updated. You can sign in with it now.");
      window.setTimeout(() => {
        void navigate({ to: "/master-admin/login", replace: true });
      }, 1400);
    } catch {
      setError("The password could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mw-admin mw-admin-gate">
      <div className="mw-admin-gate-wrap">
        <section className="mw-admin-gate-intro">
          <span className="mw-admin-eyebrow">
            <ShieldCheck size={15} /> Account recovery
          </span>
          <h1 className="mw-admin-gate-title">
            Choose a <em>new</em> password.
          </h1>
          <p className="mw-admin-gate-text">
            This page only works from the reset link sent to your staff email. The link signs you in
            once so you can set a new password for the same account.
          </p>
          <ul className="mw-admin-gate-list">
            <li>
              <span>01</span> Use at least {MIN_PASSWORD_LENGTH} characters with a letter and a
              number
            </li>
            <li>
              <span>02</span> The reset link expires and can be used only once
            </li>
            <li>
              <span>03</span> After saving, sign in at the control room with the new password
            </li>
          </ul>
        </section>

        <section className="mw-admin-gate-card" aria-labelledby="reset-password-title">
          <div className="mw-admin-gate-cardhead">
            <div>
              <h2 id="reset-password-title">Reset your password</h2>
              <p>
                {status === "ready" && email
                  ? `Setting a new password for ${email}.`
                  : "Confirm the reset link, then choose a new password."}
              </p>
            </div>
            <span className="mw-admin-badge">Recovery</span>
          </div>

          {status === "checking" ? (
            <div className="mw-admin-setup-hint" data-testid="reset-checking">
              <KeyRound size={16} />
              <p>Checking your reset link…</p>
            </div>
          ) : null}

          {status === "invalid" ? (
            <>
              <div className="mw-admin-error" role="alert" data-testid="reset-invalid">
                {message ?? "This reset link is not valid."}
              </div>
              <div className="mw-admin-gate-foot">
                <span>Ask for a new link from the sign-in page.</span>
                <a href="/master-admin/login">Back to sign in</a>
              </div>
            </>
          ) : null}

          {status === "done" ? (
            <>
              <div className="mw-admin-setup-hint" data-testid="reset-done">
                <ShieldCheck size={16} />
                <p>{message ?? "Your password has been updated."}</p>
              </div>
              <div className="mw-admin-gate-foot">
                <span>Taking you to sign in…</span>
                <a href="/master-admin/login">Sign in now</a>
              </div>
            </>
          ) : null}

          {status === "ready" ? (
            <form className="mw-admin-form" onSubmit={handleSubmit} noValidate>
              {email ? (
                <label className="mw-admin-field">
                  <span>Account email</span>
                  <div className="mw-admin-input">
                    <Mail size={16} />
                    <input type="email" value={email} readOnly autoComplete="username" />
                  </div>
                </label>
              ) : null}

              <label className="mw-admin-field">
                <span>New password</span>
                <div className="mw-admin-input">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    data-testid="reset-password"
                    required
                  />
                </div>
              </label>

              <label className="mw-admin-field">
                <span>Confirm new password</span>
                <div className="mw-admin-input">
                  <KeyRound size={16} />
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    data-testid="reset-confirm"
                    required
                  />
                </div>
              </label>

              {error ? (
                <p className="mw-admin-error" role="alert" data-testid="reset-error">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="mw-admin-submit"
                disabled={busy}
                data-testid="reset-submit"
              >
                {busy ? "Saving…" : "Save new password"}
                <ArrowRight size={17} />
              </button>

              <div className="mw-admin-gate-foot">
                <span>Remembered it after all?</span>
                <a href="/master-admin/login">Back to sign in</a>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
