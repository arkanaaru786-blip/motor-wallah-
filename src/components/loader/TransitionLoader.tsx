import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Site-wide page-transition overlay. Same orbit artwork as the demo, but with no
 * caption and no close button, and it fades itself out once the next route is ready.
 */

const VEHICLES = [
  "car",
  "bike",
  "auto",
  "scv",
  "truck",
  "bus",
  "tractor",
  "taxi",
] as const;

/** Long enough to read as intentional on instant navigations, short enough not to nag. */
const MIN_VISIBLE_MS = 420;
/** Matches the opacity transition in PageLoader.css. */
const FADE_MS = 300;

export function TransitionLoader() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();

    // The standalone demo renders the loader itself — never stack two.
    if (pathname.startsWith("/demo-loader")) {
      setVisible(false);
      setLeaving(false);
      return;
    }

    if (isLoading) {
      shownAt.current = Date.now();
      setLeaving(false);
      setVisible(true);
      return;
    }

    if (!visible) return;

    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    timers.current.push(
      window.setTimeout(() => {
        setLeaving(true);
        timers.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setLeaving(false);
          }, FADE_MS),
        );
      }, remaining),
    );

    return clearTimers;
  }, [isLoading, pathname, visible]);

  useEffect(() => clearTimers, []);

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
