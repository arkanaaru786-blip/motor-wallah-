import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import {
  MOCK_OTP,
  OTP_LENGTH,
  createAccount,
  maskMobile,
  profileFor,
  sendOtp,
  signIn,
  signOut,
  useCustomerSession,
  verifyOtp,
} from "@/lib/account-store";

const TITLE = "Login or Create Your Account | Motor Wallah";
const DESCRIPTION =
  "Sign in to Motor Wallah with your mobile number to track saved vehicles, offers, listings and every application you have submitted.";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

type Step = "mobile" | "otp" | "details";

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "mobile", label: "Mobile" },
  { id: "otp", label: "Verify" },
  { id: "details", label: "Details" },
];

function LoginPage() {
  const { ready, customer } = useCustomerSession();
  const navigate = Route.useNavigate();

  const [step, setStep] = useState<Step>("mobile");
  const [mobileInput, setMobileInput] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState({ name: "", email: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stepIndex = STEP_LABELS.findIndex((item) => item.id === step);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    const result = sendOtp(mobileInput);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMobile(result.mobile);
    setCode("");
    setError(null);
    setNotice(`Demo code ${MOCK_OTP} sent to ${maskMobile(result.mobile)}. No real SMS is sent.`);
    setStep("otp");
  };

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();
    const result = verifyOtp(code);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (profileFor(mobile)) {
      const signed = signIn(mobile);
      if (!signed.ok) {
        setError(signed.error ?? "Could not sign in on this device.");
        return;
      }
      navigate({ to: "/account" });
      return;
    }
    setNotice(null);
    setStep("details");
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const result = createAccount({ mobile, ...profile });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    navigate({ to: "/account" });
  };

  return (
    <div className="mw-sell mw-acct mw-acct-authpage">
      <SiteHeader pills />
      <main className="mw-acct-auth-main">
        <div className="mw-acct-auth-wrap">
          <section className="mw-acct-auth-intro">
            <p className="mw-sell-hero-kicker">
              <span /> Customer account
            </p>
            <h1 className="mw-acct-auth-title">
              One login for <em>everything</em> you do on Motor Wallah.
            </h1>
            <p className="mw-acct-auth-text">
              Your saved vehicles, seller chats, offers, listings and every application — finance,
              insurance, service or franchise — stay together in one dashboard.
            </p>
            <ul className="mw-acct-auth-perks">
              <li>
                <BadgeCheck size={17} aria-hidden="true" /> No password to remember — verify your
                mobile once.
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" /> One account type only. You are always
                simply a customer.
              </li>
              <li>
                <Smartphone size={17} aria-hidden="true" /> Cards, offers and applications are
                stored on this device.
              </li>
            </ul>
          </section>

          <div className="mw-acct-auth-card" data-testid="login-card">
            <div className="mw-acct-auth-brand">
              <span className="mw-acct-wordmark">
                MOTOR <em>WALLAH</em>
              </span>
              <span className="mw-acct-auth-brand-note">Customer login</span>
            </div>

            {ready && customer ? (
              <div className="mw-acct-signedin" data-testid="already-signed-in">
                <span className="mw-acct-avatar" aria-hidden="true">
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <h2 className="mw-acct-signedin-name">{customer.name}</h2>
                <p className="mw-acct-signedin-meta">
                  {maskMobile(customer.mobile)} · {customer.city}
                </p>
                <Link to="/account" className="mw-acct-cta">
                  Continue to dashboard <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  className="mw-acct-linkbtn"
                  onClick={() => {
                    signOut();
                    setStep("mobile");
                    setMobileInput("");
                    setMobile("");
                    setCode("");
                    setNotice(null);
                    setError(null);
                  }}
                >
                  <LogOut size={14} aria-hidden="true" /> Sign out
                </button>
              </div>
            ) : (
              <>
                <ol className="mw-acct-auth-steps" aria-label="Login progress">
                  {STEP_LABELS.map((item, index) => (
                    <li
                      key={item.id}
                      className="mw-acct-auth-step"
                      data-state={
                        index < stepIndex ? "done" : index === stepIndex ? "active" : "todo"
                      }
                    >
                      <span className="mw-acct-auth-step-dot">{index + 1}</span>
                      {item.label}
                    </li>
                  ))}
                </ol>

                {step === "mobile" && (
                  <form className="mw-acct-auth-form" onSubmit={handleSend} noValidate>
                    <h2 className="mw-acct-auth-h">Login or sign up</h2>
                    <p className="mw-acct-auth-sub">
                      Enter your mobile number. New numbers get a profile in the next step — there
                      is no password to remember and nothing else to pick.
                    </p>
                    <label className="mw-acct-label" htmlFor="login-mobile">
                      Mobile number
                    </label>
                    <div className="mw-acct-phone">
                      <span aria-hidden="true">+91</span>
                      <input
                        id="login-mobile"
                        data-testid="login-mobile"
                        className="mw-acct-input"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="98765 43210"
                        value={mobileInput}
                        onChange={(event) => {
                          setMobileInput(event.target.value.replace(/\D/g, "").slice(0, 10));
                          setError(null);
                        }}
                      />
                    </div>
                    {error && (
                      <p className="mw-acct-error" role="alert" data-testid="login-error">
                        {error}
                      </p>
                    )}
                    <button type="submit" className="mw-acct-cta" data-testid="send-otp">
                      Send OTP <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <p className="mw-acct-demo" data-testid="demo-otp">
                      Demo login · the verification code is <strong>{MOCK_OTP}</strong>
                    </p>
                  </form>
                )}

                {step === "otp" && (
                  <form className="mw-acct-auth-form" onSubmit={handleVerify} noValidate>
                    <h2 className="mw-acct-auth-h">Verify your number</h2>
                    <p className="mw-acct-auth-sub">
                      Enter the {OTP_LENGTH}-digit code for {maskMobile(mobile)}.
                    </p>
                    <label className="mw-acct-label" htmlFor="otp-code">
                      Verification code
                    </label>
                    <input
                      id="otp-code"
                      data-testid="otp-code"
                      className="mw-acct-input mw-acct-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={OTP_LENGTH}
                      placeholder="••••"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                        setError(null);
                      }}
                    />
                    {notice && (
                      <p className="mw-acct-note" data-testid="otp-notice">
                        {notice}
                      </p>
                    )}
                    {error && (
                      <p className="mw-acct-error" role="alert" data-testid="login-error">
                        {error}
                      </p>
                    )}
                    <button type="submit" className="mw-acct-cta" data-testid="verify-otp">
                      Verify &amp; continue <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <div className="mw-acct-row-between">
                      <button
                        type="button"
                        className="mw-acct-linkbtn"
                        data-testid="resend-code"
                        onClick={() => {
                          setCode("");
                          setError(null);
                          setNotice(`Demo code ${MOCK_OTP} sent again to ${maskMobile(mobile)}.`);
                        }}
                      >
                        Resend code
                      </button>
                      <button
                        type="button"
                        className="mw-acct-linkbtn"
                        data-testid="change-number"
                        onClick={() => {
                          setStep("mobile");
                          setCode("");
                          setError(null);
                          setNotice(null);
                        }}
                      >
                        Change number
                      </button>
                    </div>
                  </form>
                )}

                {step === "details" && (
                  <form className="mw-acct-auth-form" onSubmit={handleCreate} noValidate>
                    <h2 className="mw-acct-auth-h">Create your profile</h2>
                    <p className="mw-acct-auth-sub">
                      {maskMobile(mobile)} is new here. Add your details once — your dashboard opens
                      right after.
                    </p>
                    <label className="mw-acct-label" htmlFor="signup-name">
                      Full name
                    </label>
                    <input
                      id="signup-name"
                      data-testid="signup-name"
                      className="mw-acct-input"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={profile.name}
                      onChange={(event) => {
                        setProfile({ ...profile, name: event.target.value });
                        setError(null);
                      }}
                    />
                    <label className="mw-acct-label" htmlFor="signup-email">
                      Email
                    </label>
                    <input
                      id="signup-email"
                      data-testid="signup-email"
                      className="mw-acct-input"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={profile.email}
                      onChange={(event) => {
                        setProfile({ ...profile, email: event.target.value });
                        setError(null);
                      }}
                    />
                    <label className="mw-acct-label" htmlFor="signup-city">
                      City
                    </label>
                    <input
                      id="signup-city"
                      data-testid="signup-city"
                      className="mw-acct-input"
                      autoComplete="address-level2"
                      placeholder="Indore"
                      value={profile.city}
                      onChange={(event) => {
                        setProfile({ ...profile, city: event.target.value });
                        setError(null);
                      }}
                    />
                    {error && (
                      <p className="mw-acct-error" role="alert" data-testid="login-error">
                        {error}
                      </p>
                    )}
                    <button type="submit" className="mw-acct-cta" data-testid="create-account">
                      Create my account <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <p className="mw-acct-note">
                      One account type only — every Motor Wallah account is simply a customer.
                    </p>
                  </form>
                )}

                <p className="mw-acct-legal">
                  By continuing you agree to Motor Wallah&apos;s terms and privacy policy. This demo
                  stores your profile on this device only.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
