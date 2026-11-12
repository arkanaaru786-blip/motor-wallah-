import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import "./PageLoader.css";

/**
 * Site-wide page-transition overlay: the same orbit artwork as the demo, but with
 * no caption and no close button. It appears when a navigation starts and fades
 * out once the destination route has resolved.
 */

const VEHICLES = ["car", "bike", "auto", "scv", "truck", "bus", "tractor", "taxi"] as const;

/** Short enough not to annoy, long enough that an instant navigation still reads. */
const MIN_VISIBLE_MS = 420;
/** Matches the opacity transition in PageLoader.css. */
const FADE_MS = 300;
/** Failsafe: never leave the overlay covering the site if an event goes missing. */
const MAX_VISIBLE_MS = 4000;

export function TransitionLoader() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const hide = () => {
    if (!shownAt.current) return;
    clearTimers();
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    timers.current.push(
      window.setTimeout(() => {
        setLeaving(true);
        timers.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setLeaving(false);
            shownAt.current = 0;
          }, FADE_MS),
        );
      }, wait),
    );
  };

  const show = () => {
    // The demo route renders its own loader — never stack a second one.
    if (window.location.pathname.startsWith("/demo-loader")) return;
    clearTimers();
    shownAt.current = Date.now();
    setLeaving(false);
    setVisible(true);
    timers.current.push(window.setTimeout(hide, MAX_VISIBLE_MS));
  };

  useEffect(() => {
    const unsubscribe = [
      router.subscribe("onBeforeNavigate", show),
      router.subscribe("onResolved", hide),
    ];
    return () => {
      unsubscribe.forEach((off) => off());
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Belt and braces: poll the router's own loading flag while the overlay is up,
  // so a missed lifecycle event can never leave the site covered.
  useEffect(() => {
    if (!visible || leaving) return;
    const id = window.setInterval(() => {
      if (!router.state.isLoading) hide();
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leaving, router]);

  if (!visible) return null;

  return (
    <div
      className={`loader-overlay loader-overlay--transition${leaving ? " is-leaving" : ""}`}
      aria-hidden="true"
    >
      <div className="orbit-container">
        <div className="center-logo">
          <img src="/images/MW-logo.png" alt="" />
        </div>
        <div className="orbit">
          {VEHICLES.map((name, index) => (
            <img
              key={name}
              src={`/images/${name}.png`}
              alt=""
              className={`vehicle pos-${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
