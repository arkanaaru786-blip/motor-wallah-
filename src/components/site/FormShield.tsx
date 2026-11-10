import { useEffect, useRef, useState } from "react";
import { hasRecaptcha, recaptchaSiteKey } from "@/lib/analytics";

let recaptchaScriptPromise: Promise<void> | null = null;

function loadRecaptchaScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (recaptchaScriptPromise) return recaptchaScriptPromise;
  recaptchaScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-mw-recaptcha="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset["mwRecaptcha"] = "1";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return recaptchaScriptPromise;
}

export function useRecaptchaToken() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<number | null>(null);
  const [ready, setReady] = useState(!hasRecaptcha());

  useEffect(() => {
    if (!hasRecaptcha() || !containerRef.current) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void loadRecaptchaScript().then(() => {
      const api = window.grecaptcha;
      const el = containerRef.current;
      if (!api || !el || cancelled) {
        setReady(true);
        return;
      }
      api.ready(() => {
        if (cancelled || !containerRef.current) return;
        // Avoid duplicate render on remounts.
        if (widgetId.current === null) {
          try {
            widgetId.current = api.render(containerRef.current, {
              sitekey: recaptchaSiteKey(),
              theme: "light",
              size: "normal",
            });
          } catch {
            /* ignore render failures */
          }
        }
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getToken = () => {
    if (!hasRecaptcha()) return "";
    try {
      return window.grecaptcha?.getResponse(widgetId.current ?? undefined) ?? "";
    } catch {
      return "";
    }
  };

  const reset = () => {
    try {
      if (hasRecaptcha()) window.grecaptcha?.reset(widgetId.current ?? undefined);
    } catch {
      /* ignore */
    }
  };

  return { containerRef, ready, getToken, reset, enabled: hasRecaptcha() };
}

export function FormShield({
  containerRef,
  ready,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
}) {
  if (!hasRecaptcha()) return null;
  return (
    <div className="mw-form-shield">
      <div ref={containerRef} className="mw-recaptcha-slot" aria-label="Security check" />
      {!ready ? <p className="mw-form-shield-note">Loading security check…</p> : null}
      <p className="mw-form-shield-note">Protected with reCAPTCHA and bot checks.</p>
    </div>
  );
}
