import { useEffect, useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
import { analyticsConsent, setAnalyticsConsent } from "@/lib/analytics";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(analyticsConsent() === "unset");
    const onChange = () => setVisible(analyticsConsent() === "unset");
    window.addEventListener("mw:analytics-consent", onChange as EventListener);
    return () => window.removeEventListener("mw:analytics-consent", onChange as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div className="mw-consent" role="dialog" aria-live="polite" aria-label="Privacy and cookie consent">
      <div className="mw-consent-card">
        <div className="mw-consent-icon" aria-hidden="true">
          <Cookie size={18} />
        </div>
        <div className="mw-consent-copy">
          <p className="mw-consent-title">
            <ShieldCheck size={14} /> Privacy & analytics consent
          </p>
          <p className="mw-consent-text">
            We use essential storage and, with your permission, privacy-friendly analytics (GA4 and
            session events) to understand visits, improve pages, and detect fake leads. You can
            continue without analytics.
          </p>
        </div>
        <div className="mw-consent-actions">
          <button
            type="button"
            className="mw-consent-btn is-secondary"
            onClick={() => {
              setAnalyticsConsent("denied");
              setVisible(false);
            }}
          >
            Only essential
          </button>
          <button
            type="button"
            className="mw-consent-btn is-primary"
            onClick={() => {
              setAnalyticsConsent("granted");
              setVisible(false);
            }}
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
