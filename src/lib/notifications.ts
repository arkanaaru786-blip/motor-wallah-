/**
 * Foreground alerts for whatever this browser is signed in as.
 *
 * In-app: a glass toast (rendered by components/notify/ToastHost.tsx) that
 * slides in at the top-right, clears itself after four seconds and can be
 * dismissed. Background: if the visitor has allowed browser notifications, a
 * message that lands while the tab is hidden also becomes a system
 * notification, so the alert still arrives off-screen.
 *
 * Nothing here uses a paid service — the Web Notifications API is part of the
 * browser, and the messages themselves come from Supabase.
 */
import { toast } from "sonner";

export const TOAST_DURATION_MS = 4000;

/** Set once the visitor clicks the dashboard button and grants permission. */
const OPT_IN_KEY = "mw_native_notifications";

export type NotificationSide = "buyer" | "dealer";

const CHAT_HREF: Record<NotificationSide, string> = {
  buyer: "/account?tab=chats",
  dealer: "/dealer?tab=chats",
};

type Alert = { title: string; body: string; href: string; tag: string };

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

const remember = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(OPT_IN_KEY, "1");
    else window.localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* private mode: the permission itself still decides */
  }
};

/** Permission granted *and* switched on from this dashboard. */
export function nativeAlertsEnabled(): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    return window.localStorage.getItem(OPT_IN_KEY) === "1";
  } catch {
    return true;
  }
}

export async function requestNativeAlerts(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") {
    remember(true);
    return "granted";
  }
  const result = await Notification.requestPermission().catch(
    () => "denied" as NotificationPermission,
  );
  if (result === "granted") remember(true);
  return result;
}

/** A system notification, only when the visitor opted in. */
function showNative(alert: Alert): boolean {
  if (!nativeAlertsEnabled()) return false;
  try {
    const note = new Notification(alert.title, {
      body: alert.body,
      tag: alert.tag,
      icon: "/favicon.ico",
    });
    note.onclick = () => {
      window.focus();
      window.location.assign(alert.href);
      note.close();
    };
    return true;
  } catch {
    // Some browsers refuse constructor notifications; the toast still works.
    return false;
  }
}

function showToast(alert: Alert, actionLabel: string) {
  toast(alert.title, {
    // A repeat for the same conversation replaces the toast still on screen
    // instead of stacking one per message.
    id: alert.tag,
    description: alert.body,
    duration: TOAST_DURATION_MS,
    closeButton: true,
    action: { label: actionLabel, onClick: () => window.location.assign(alert.href) },
  });
}

/**
 * One alert, delivered the least annoying way: system notification when the tab
 * is in the background, glass toast when the visitor is looking at the page.
 * Never both.
 */
function raise(alert: Alert, actionLabel: string) {
  if (typeof window === "undefined") return;
  if (document.visibilityState !== "visible" && showNative(alert)) return;
  showToast(alert, actionLabel);
}

/** "New message from Skyline Cars: <preview>" */
export function notifyNewMessage(input: {
  side: NotificationSide;
  name: string;
  preview: string;
  chatId: string;
  vehicle?: string;
}) {
  raise(
    {
      title: `New message from ${input.name}`,
      body: input.vehicle ? `${input.preview} — ${input.vehicle}` : input.preview,
      href: CHAT_HREF[input.side],
      tag: `mw-msg-${input.chatId}`,
    },
    "Open chat",
  );
}

export function notifyOrderStatus(input: { orderRef: string; status: string }) {
  raise(
    {
      title: "Order status updated",
      body: `${input.orderRef} is now ${input.status}. Open My Orders for the details.`,
      href: "/account?tab=orders",
      tag: `mw-order-${input.orderRef}`,
    },
    "View order",
  );
}

/** "You have 3 unread messages and 1 new offer." */
export function notifyDashboardDigest(input: {
  unread: number;
  offers: number;
  side: NotificationSide;
}) {
  const parts: string[] = [];
  if (input.unread > 0)
    parts.push(`${input.unread} unread ${input.unread === 1 ? "message" : "messages"}`);
  if (input.offers > 0)
    parts.push(`${input.offers} new ${input.offers === 1 ? "offer" : "offers"}`);
  if (parts.length === 0) return;

  raise(
    {
      title: `You have ${parts.join(" and ")}.`,
      body:
        input.side === "dealer"
          ? "Open My Chats to answer buyers, or Offers to accept or decline."
          : "Open My Chats to reply, or My Orders to track a purchase.",
      href: input.side === "dealer" ? "/dealer?tab=chats" : "/account?tab=chats",
      tag: "mw-dashboard-digest",
    },
    "Open dashboard",
  );
}
