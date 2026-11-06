import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

import {
  nativeAlertsEnabled,
  notificationPermission,
  requestNativeAlerts,
} from "@/lib/notifications";

type State = NotificationPermission | "unsupported";

/**
 * "Enable Browser Notifications".
 *
 * Asks the browser once, on a click — never on load — and then reports the
 * state it is actually in: on, blocked in the browser's own settings, or not
 * available in this browser at all.
 */
export function NotificationPermissionButton() {
  const [permission, setPermission] = useState<State>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read after mount: the permission API does not exist during SSR.
  useEffect(() => {
    setPermission(notificationPermission());
    setEnabled(nativeAlertsEnabled());
  }, []);

  if (permission === "unsupported") return null;

  if (enabled) {
    return (
      <span className="mw-notify-pill" data-testid="notify-on">
        <BellRing size={14} aria-hidden="true" /> Browser alerts on
      </span>
    );
  }

  if (permission === "denied") {
    return (
      <span className="mw-notify-pill is-blocked" data-testid="notify-blocked">
        <BellOff size={14} aria-hidden="true" /> Notifications blocked in browser settings
      </span>
    );
  }

  const ask = async () => {
    setBusy(true);
    const result = await requestNativeAlerts();
    setPermission(result);
    setEnabled(result === "granted");
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="mw-notify-btn"
      onClick={() => void ask()}
      disabled={busy}
      data-testid="notify-enable"
    >
      <Bell size={14} aria-hidden="true" />
      {busy ? "Asking your browser…" : "Enable Browser Notifications"}
    </button>
  );
}
