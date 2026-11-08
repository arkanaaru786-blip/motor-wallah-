import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, ShieldCheck, Store } from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import { currentDealer, signInDealer, useDealerSession } from "@/lib/dealer-session";
import {
  DEMO_DEALER_PASSWORD,
  ensureDealers,
  findDealerByMobile,
  listDealers,
  resetDealerPasswordByMobile,
  type Dealer,
} from "@/lib/dealers";
import { dealerLoginId } from "@/lib/partner-ids";
import { MOCK_OTP, OTP_LENGTH, maskMobile, validateMobile } from "@/lib/account-store";

export const Route = createFileRoute("/dealer-login")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (currentDealer()) throw redirect({ to: "/dealer" });
  },
  head: () => ({
    meta: [
      { title: "Partner Login | Motor Wallah" },
      {
        name: "description",
        content:
          "Sign in to the Motor Wallah partner portal with the ID and temporary password issued by the administrator.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DealerLoginRoute,
});

type Mode = "signin" | "forgot-mobile" | "forgot-otp" | "forgot-reset" | "forgot-done";

const FORGOT_STEPS: { id: Mode; label: string }[] = [
  { id: "forgot-mobile", label: "Mobile" },
  { id: "forgot-otp", label: "Verify" },
  { id: "forgot-reset", label: "New password" },
];

function DealerLoginRoute() {
  const { ready, session } = useDealerSession();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [mode, setMode] = useState<Mode>("signin");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forgot-password state.
  const [resetMobile, setResetMobile] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Seeded once per browser: one working login per vehicle category.
  useEffect(() => {
    let cancelled = false;
    void ensureDealers().then(() => {
      if (!cancelled) setDealers(listDealers());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/dealer", replace: true });
  }, [ready, session, navigate]);

  const startForgot = () => {
    setMode("forgot-mobile");
    setError(null);
    setNotice(null);
    setResetMobile("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const backToSignIn = () => {
    setMode("signin");
    setError(null);
    setNotice(null);
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await signInDealer(identity, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void navigate({ to: "/dealer" });
  };

  const sendResetCode = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validated = validateMobile(resetMobile);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    const dealer = findDealerByMobile(validated.mobile);
    if (!dealer) {
      setError("No partner account is registered against that mobile number.");
      return;
    }
    setResetMobile(validated.mobile);
    setResetCode("");
    setMode("forgot-otp");
    setNotice(
      `Demo code ${MOCK_OTP} sent to ${maskMobile(validated.mobile)}. No SMS is sent in this build.`,
    );
  };

  const verifyResetCode = (event: React.FormEvent) => {
    event.preventDefault();
    const digits = resetCode.replace(/\D/g, "");
    if (digits.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    if (digits !== MOCK_OTP) {
      setError(`That code does not match. This demo uses ${MOCK_OTP}.`);
      return;
    }
    setError(null);
    setNotice(null);
    setMode("forgot-reset");
  };

  const saveNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    const result = await resetDealerPasswordByMobile(resetMobile, newPassword);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("forgot-done");
    setNotice(
      `${result.dealer.showroom} — you can now sign in with ${dealerLoginId(result.dealer)} and your new password.`,
    );
    setIdentity(dealerLoginId(result.dealer));
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setResetCode("");
  };

  const forgotIndex = FORGOT_STEPS.findIndex((item) => item.id === mode);

  return (
    <div className="mw-dealer mw-dealer-login">
      <div className="mw-dealer-login-card">
        <div className="mw-dealer-login-main">
          <div className="mw-dealer-brand">
            <span className="mw-dealer-brand-mark" aria-hidden="true">
              <Store size={19} />
            </span>
            <div>
              <strong>Motor Wallah Partner Portal</strong>
              <span>Issued partner ID and password only</span>
            </div>
          </div>

          {mode === "signin" ? (
            <>
              <div>
                <h1>Partner sign in</h1>
                <p className="mw-dealer-login-lede">
                  Use the partner ID and temporary password Motor Wallah issued to you — for example{" "}
                  <code>MW-DLR-1001</code>. There is no email step: your account is bound to one
                  vehicle category and the portal opens directly on it.
                </p>
              </div>

              <form className="mw-dealer-form" onSubmit={signIn} data-testid="dealer-login-form">
                <label className="mw-dealer-field">
                  <span>Partner ID</span>
                  <input
                    type="text"
                    name="username"
                    value={identity}
                    onChange={(event) => {
                      setIdentity(event.target.value);
                      setError(null);
                    }}
                    placeholder="MW-DLR-1001"
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    data-testid="dealer-login-id"
                  />
                </label>

                <label className="mw-dealer-field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    autoComplete="current-password"
                    placeholder="The password shared with you"
                    required
                    data-testid="dealer-login-password"
                  />
                </label>

                {error ? (
                  <p className="mw-dealer-error" role="alert" data-testid="dealer-login-error">
                    {error}
                  </p>
                ) : null}

                <div className="mw-dealer-form-actions">
                  <button
                    type="submit"
                    className="mw-dealer-btn is-primary"
                    disabled={busy}
                    data-testid="dealer-login-submit"
                  >
                    <KeyRound size={15} /> {busy ? "Checking…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    className="mw-dealer-link"
                    onClick={startForgot}
                    data-testid="dealer-forgot-open"
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </>
          ) : (
            <section className="mw-authforgot" data-testid="dealer-forgot">
              <div className="mw-authforgot-head">
                <div>
                  <h2>Reset your partner password</h2>
                  <p>
                    We verify the mobile number registered against your partner account, then you
                    choose a new password. Your partner ID stays the same.
                  </p>
                </div>
                <button
                  type="button"
                  className="mw-dealer-link"
                  onClick={backToSignIn}
                  data-testid="dealer-forgot-cancel"
                >
                  Back to sign in
                </button>
              </div>

              {mode !== "forgot-done" ? (
                <ol className="mw-authforgot-steps" aria-label="Reset progress">
                  {FORGOT_STEPS.map((item, index) => (
                    <li
                      key={item.id}
                      data-state={
                        index < forgotIndex ? "done" : index === forgotIndex ? "active" : "todo"
                      }
                    >
                      {item.label}
                    </li>
                  ))}
                </ol>
              ) : null}

              {mode === "forgot-mobile" ? (
                <form className="mw-authforgot-form" onSubmit={sendResetCode} noValidate>
                  <label className="mw-dealer-field">
                    <span>Registered mobile number</span>
                    <input
                      type="tel"
                      name="mobile"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      placeholder="9820011201"
                      value={resetMobile}
                      onChange={(event) => {
                        setResetMobile(event.target.value.replace(/\D/g, "").slice(0, 10));
                        setError(null);
                      }}
                      data-testid="dealer-forgot-mobile"
                    />
                  </label>
                  {error ? (
                    <p className="mw-dealer-error" role="alert" data-testid="dealer-forgot-error">
                      {error}
                    </p>
                  ) : null}
                  <div className="mw-authforgot-actions">
                    <button
                      type="submit"
                      className="mw-dealer-btn is-primary"
                      data-testid="dealer-forgot-send"
                    >
                      Send OTP <ArrowRight size={14} />
                    </button>
                    <span className="mw-authforgot-note">
                      Demo build · the code is <strong>{MOCK_OTP}</strong>.
                    </span>
                  </div>
                </form>
              ) : null}

              {mode === "forgot-otp" ? (
                <form className="mw-authforgot-form" onSubmit={verifyResetCode} noValidate>
                  <p className="mw-authforgot-note" data-testid="dealer-forgot-notice">
                    {notice}
                  </p>
                  <label className="mw-dealer-field">
                    <span>Verification code</span>
                    <input
                      type="text"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={OTP_LENGTH}
                      placeholder="••••"
                      value={resetCode}
                      onChange={(event) => {
                        setResetCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                        setError(null);
                      }}
                      data-testid="dealer-forgot-otp"
                    />
                  </label>
                  {error ? (
                    <p className="mw-dealer-error" role="alert" data-testid="dealer-forgot-error">
                      {error}
                    </p>
                  ) : null}
                  <div className="mw-authforgot-actions">
                    <button
                      type="submit"
                      className="mw-dealer-btn is-primary"
                      data-testid="dealer-forgot-verify"
                    >
                      Verify code <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="mw-dealer-link"
                      onClick={() => {
                        setMode("forgot-mobile");
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      Change number
                    </button>
                  </div>
                </form>
              ) : null}

              {mode === "forgot-reset" ? (
                <form className="mw-authforgot-form" onSubmit={saveNewPassword} noValidate>
                  {/* Password managers expect an identifier beside a new password;
                      keep the ID in the form so they can save the pair. */}
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={identity}
                    readOnly
                    hidden
                  />
                  <label className="mw-dealer-field">
                    <span>New password</span>
                    <input
                      type="password"
                      name="new-password"
                      autoComplete="new-password"
                      placeholder="At least 10 characters, letters and a number"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setError(null);
                      }}
                      data-testid="dealer-forgot-new"
                    />
                  </label>
                  <label className="mw-dealer-field">
                    <span>Confirm new password</span>
                    <input
                      type="password"
                      name="confirm-password"
                      autoComplete="new-password"
                      placeholder="Type it again"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setError(null);
                      }}
                      data-testid="dealer-forgot-confirm"
                    />
                  </label>
                  {error ? (
                    <p className="mw-dealer-error" role="alert" data-testid="dealer-forgot-error">
                      {error}
                    </p>
                  ) : null}
                  <div className="mw-authforgot-actions">
                    <button
                      type="submit"
                      className="mw-dealer-btn is-primary"
                      disabled={busy}
                      data-testid="dealer-forgot-save"
                    >
                      {busy ? "Saving…" : "Save new password"}
                    </button>
                    <span className="mw-authforgot-note">
                      Stored as a salted PBKDF2 hash — never as plain text.
                    </span>
                  </div>
                </form>
              ) : null}

              {mode === "forgot-done" ? (
                <div className="mw-authforgot-ok" role="status" data-testid="dealer-forgot-done">
                  <strong>Password updated</strong>
                  <span>{notice}</span>
                  <button
                    type="button"
                    className="mw-dealer-btn is-primary"
                    onClick={backToSignIn}
                    data-testid="dealer-forgot-back"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </div>

        <aside className="mw-dealer-login-aside">
          <h2>{mode === "signin" ? "Demo partner logins" : "Need your partner ID?"}</h2>
          {mode === "signin" ? (
            <>
              <p className="mw-dealer-demo-note">
                One account per category, created for this mock setup. Click one to fill the form —
                all use the password <code>{DEMO_DEALER_PASSWORD}</code>.
              </p>
              <ul className="mw-dealer-demo-list">
                {dealers.map((dealer) => (
                  <li key={dealer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setIdentity(dealerLoginId(dealer));
                        setPassword(DEMO_DEALER_PASSWORD);
                        setError(null);
                      }}
                      data-testid={`dealer-demo-${dealer.category}`}
                    >
                      <strong>{dealerCategoryLabel(dealer.category)}</strong>
                      <span>
                        {dealer.status} · {dealerLoginId(dealer)}
                      </span>
                    </button>
                  </li>
                ))}
                {dealers.length === 0 ? (
                  <li className="mw-dealer-demo-note">Preparing demo partner accounts…</li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="mw-dealer-demo-note">
              Your partner ID was shared when the account was created — it looks like{" "}
              <code>MW-DLR-1001</code>. If you no longer have it, ask the Motor Wallah team to
              re-issue it; the ID never changes, only the password can be reset here.
            </p>
          )}
          <p className="mw-dealer-demo-note">
            <ShieldCheck size={13} /> Each login sees only its own category: a Cars partner has no
            Bikes, Trucks or Taxi anywhere in the portal.
          </p>
          <p className="mw-dealer-demo-note">
            Customer? <Link to="/login">Sign in with your mobile</Link> · Staff?{" "}
            <Link to="/employee-login">Employee login</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
