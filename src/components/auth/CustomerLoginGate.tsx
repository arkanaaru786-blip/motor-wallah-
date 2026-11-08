import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Lock, Smartphone, X } from "lucide-react";

import {
  GATE_COPY,
  completeCustomerLogin,
  dismissCustomerLogin,
  useCustomerLoginRequest,
  type CustomerGateRequest,
} from "@/lib/customer-gate";
import {
  MOCK_OTP,
  OTP_LENGTH,
  createAccount,
  maskMobile,
  profileFor,
  sendOtp,
  signIn,
  verifyOtp,
} from "@/lib/account-store";

type Step = "mobile" | "otp" | "details";

const STEPS: { id: Step; label: string }[] = [
  { id: "mobile", label: "Mobile" },
  { id: "otp", label: "Verify" },
  { id: "details", label: "Details" },
];

/**
 * The login pop-up behind gated actions.
 *
 * Mounted once in the root route and opened by `gateCustomerAction()` — the
 * homepage is never interrupted; only "make an offer", "chat with the seller"
 * and "send your message" ask for a verified mobile number.
 */
export function CustomerLoginGate() {
  const request = useCustomerLoginRequest();
  if (!request) return null;
  return <CustomerLoginDialog request={request} />;
}

function CustomerLoginDialog({ request }: { request: CustomerGateRequest }) {
  const copy = GATE_COPY[request.reason];
  const [step, setStep] = useState<Step>("mobile");
  const [mobileInput, setMobileInput] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState({ name: "", email: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => {
    setError(null);
    dismissCustomerLogin();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  const stepIndex = STEPS.findIndex((item) => item.id === step);

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
    const existing = profileFor(mobile);
    if (existing) {
      const signed = signIn(mobile);
      if (!signed.ok) {
        setError(signed.error ?? "Could not sign you in on this device.");
        return;
      }
      completeCustomerLogin();
      return;
    }
    setNotice(null);
    setProfile({ name: "", email: "", city: "" });
    setStep("details");
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const result = createAccount({ mobile, ...profile });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    completeCustomerLogin();
  };

  return (
    <div className="mw-authdlg" data-testid="customer-login-dialog">
      <button
        type="button"
        className="mw-authdlg-backdrop"
        aria-label="Close sign in"
        onClick={close}
        tabIndex={-1}
      />
      <div
        className="mw-authdlg-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mw-authdlg-title"
      >
        <header className="mw-authdlg-head">
          <span className="mw-authdlg-wordmark">
            MOTOR <em>WALLAH</em>
          </span>
          <button
            type="button"
            className="mw-authdlg-close"
            aria-label="Close sign in"
            onClick={close}
            data-testid="login-dialog-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <ol className="mw-authdlg-steps" aria-label="Login progress">
          {STEPS.map((item, index) => (
            <li
              key={item.id}
              data-state={index < stepIndex ? "done" : index === stepIndex ? "active" : "todo"}
            >
              <span aria-hidden="true">{index + 1}</span>
              {item.label}
            </li>
          ))}
        </ol>

        {step === "mobile" && (
          <form className="mw-authdlg-form" onSubmit={handleSend} noValidate>
            <p className="mw-authdlg-kicker">{copy.kicker}</p>
            <h2 className="mw-authdlg-title" id="mw-authdlg-title">
              {copy.title}
            </h2>
            <p className="mw-authdlg-text">{copy.body}</p>
            <label className="mw-authdlg-label" htmlFor="gate-mobile">
              Mobile number
            </label>
            <div className="mw-authdlg-phone">
              <span aria-hidden="true">+91</span>
              <input
                id="gate-mobile"
                name="mobile"
                data-testid="gate-mobile"
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
              <p className="mw-authdlg-error" role="alert" data-testid="gate-error">
                {error}
              </p>
            )}
            <button type="submit" className="mw-authdlg-cta" data-testid="gate-send-otp">
              Send OTP <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="mw-authdlg-note">
              Demo login · the verification code is <strong>{MOCK_OTP}</strong>. Nothing is sent by
              SMS and no password is needed.
            </p>
          </form>
        )}

        {step === "otp" && (
          <form className="mw-authdlg-form" onSubmit={handleVerify} noValidate>
            <h2 className="mw-authdlg-title" id="mw-authdlg-title">
              Verify your number
            </h2>
            <p className="mw-authdlg-text">
              Enter the {OTP_LENGTH}-digit code for {maskMobile(mobile)}.
            </p>
            <label className="mw-authdlg-label" htmlFor="gate-otp">
              Verification code
            </label>
            <input
              id="gate-otp"
              name="otp"
              data-testid="gate-otp"
              className="mw-authdlg-input mw-authdlg-otp"
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
              <p className="mw-authdlg-note" data-testid="gate-notice">
                {notice}
              </p>
            )}
            {error && (
              <p className="mw-authdlg-error" role="alert" data-testid="gate-error">
                {error}
              </p>
            )}
            <button type="submit" className="mw-authdlg-cta" data-testid="gate-verify">
              Verify &amp; continue <ArrowRight size={16} aria-hidden="true" />
            </button>
            <div className="mw-authdlg-row">
              <button
                type="button"
                className="mw-authdlg-linkbtn"
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
                className="mw-authdlg-linkbtn"
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
          <form className="mw-authdlg-form" onSubmit={handleCreate} noValidate>
            <h2 className="mw-authdlg-title" id="mw-authdlg-title">
              Create your profile
            </h2>
            <p className="mw-authdlg-text">
              {maskMobile(mobile)} is new here. Add your details once — you go straight back to what
              you clicked.
            </p>
            <label className="mw-authdlg-label" htmlFor="gate-name">
              Full name
            </label>
            <input
              id="gate-name"
              name="name"
              data-testid="gate-name"
              className="mw-authdlg-input"
              autoComplete="name"
              placeholder="Your full name"
              value={profile.name}
              onChange={(event) => {
                setProfile({ ...profile, name: event.target.value });
                setError(null);
              }}
            />
            <label className="mw-authdlg-label" htmlFor="gate-email">
              Email
            </label>
            <input
              id="gate-email"
              name="email"
              data-testid="gate-email"
              className="mw-authdlg-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={profile.email}
              onChange={(event) => {
                setProfile({ ...profile, email: event.target.value });
                setError(null);
              }}
            />
            <label className="mw-authdlg-label" htmlFor="gate-city">
              City
            </label>
            <input
              id="gate-city"
              name="city"
              data-testid="gate-city"
              className="mw-authdlg-input"
              autoComplete="address-level2"
              placeholder="Indore"
              value={profile.city}
              onChange={(event) => {
                setProfile({ ...profile, city: event.target.value });
                setError(null);
              }}
            />
            {error && (
              <p className="mw-authdlg-error" role="alert" data-testid="gate-error">
                {error}
              </p>
            )}
            <button type="submit" className="mw-authdlg-cta" data-testid="gate-create">
              Create my account <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        )}

        <footer className="mw-authdlg-foot">
          <span className="mw-authdlg-foot-item">
            <Smartphone size={13} aria-hidden="true" /> Browsing stays open — we only ask when you
            act.
          </span>
          <span className="mw-authdlg-foot-links">
            <Link to="/dealer-login" onClick={close}>
              <KeyRound size={13} aria-hidden="true" /> Partner login
            </Link>
            <Link to="/employee-login" onClick={close}>
              <Lock size={13} aria-hidden="true" /> Employee login
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
