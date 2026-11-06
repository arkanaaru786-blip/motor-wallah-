import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useCustomerSession } from "@/lib/account-store";
import { dealerBook } from "@/lib/dealer-data";
import { currentDealer } from "@/lib/dealer-session";
import { listBuyerChats, listDealerChats, type ChatSummary } from "@/lib/live-chat";
import { listOffers } from "@/lib/listing-offers";
import {
  notifyDashboardDigest,
  notifyNewMessage,
  notifyOrderStatus,
  type NotificationSide,
} from "@/lib/notifications";
import { listMyOrders } from "@/lib/orders-api";

const CHAT_POLL_MS = 12_000;
const ORDER_POLL_MS = 60_000;
const ORDER_SEEN_KEY = "mw_order_status_seen";

const isChatPage = (pathname: string, search: string) =>
  (pathname === "/dealer" || pathname === "/account") && /tab=chats/.test(search);

const isDashboard = (pathname: string) => pathname === "/account" || pathname === "/dealer";

const readSeenOrders = (): Record<string, string> => {
  try {
    const raw = window.localStorage.getItem(ORDER_SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writeSeenOrders = (seen: Record<string, string>) => {
  try {
    window.localStorage.setItem(ORDER_SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode: alerts simply re-baseline next visit */
  }
};

/**
 * Watches for the things a signed-in visitor should hear about — a reply in one
 * of their conversations, a change to an order they placed — and raises the
 * alerts from `src/lib/notifications.ts`.
 *
 * While a conversation is on screen the toast is suppressed, because the thread
 * itself is already marking those messages read. Mounted once in the root route.
 */
export function AlertWatcher() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const { signedIn } = useCustomerSession();

  const chatPageRef = useRef(false);
  chatPageRef.current = isChatPage(pathname, search);

  // Chat replies, for whichever side this browser speaks for.
  useEffect(() => {
    let cancelled = false;
    // Last timestamp seen per conversation, so only a genuinely new message
    // alerts. `armed` stays false through the first pass, which is what keeps a
    // login from toasting the whole backlog.
    const seen = new Map<string, string>();
    let armed = false;

    const scan = async () => {
      const sources: { side: NotificationSide; chats: ChatSummary[] }[] = [];

      const buyer = await listBuyerChats();
      if (buyer.ok) sources.push({ side: "buyer", chats: buyer.chats });

      const dealer = currentDealer();
      if (dealer) {
        const own = await listDealerChats(dealer.dealerId);
        if (own.ok) sources.push({ side: "dealer", chats: own.chats });
      }

      if (cancelled) return;

      for (const source of sources) {
        for (const chat of source.chats) {
          const key = `${source.side}:${chat.id}`;
          const previous = seen.get(key);
          seen.set(key, chat.lastMessageAt);

          if (!armed) continue;
          if (chat.unread <= 0) continue;
          if (previous === chat.lastMessageAt) continue;
          // Our own reply, or a thread the visitor is already reading.
          if (chat.lastSenderRole === source.side) continue;
          if (chatPageRef.current) continue;

          notifyNewMessage({
            side: source.side,
            name:
              source.side === "buyer"
                ? chat.dealerName || "the seller"
                : chat.buyerName || "a buyer",
            preview: chat.lastMessage || "New message",
            chatId: chat.id,
            vehicle: chat.vehicleLabel,
          });
        }
      }

      armed = true;
    };

    void scan();
    const timer = window.setInterval(() => void scan(), CHAT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Order status changes for the signed-in storefront customer.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    const scan = async () => {
      const result = await listMyOrders();
      if (cancelled || !result.ok) return;

      const previous = readSeenOrders();
      const next: Record<string, string> = {};
      for (const order of result.data) {
        next[order.id] = order.status;
        const before = previous[order.id];
        if (before && before !== order.status) {
          notifyOrderStatus({ orderRef: order.order_ref, status: order.status });
        }
      }
      writeSeenOrders(next);
    };

    void scan();
    const timer = window.setInterval(() => void scan(), ORDER_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [signedIn]);

  // The summary shown when the dashboard opens: unread replies + offers waiting.
  const digestShown = useRef(false);
  useEffect(() => {
    if (!isDashboard(pathname) || digestShown.current) return;
    // Nothing to summarise on the chats tab — those messages are right there.
    if (chatPageRef.current) return;
    digestShown.current = true;

    let cancelled = false;
    const run = async () => {
      const dealer = currentDealer();
      let unread = 0;
      let offers = 0;

      if (dealer) {
        const own = await listDealerChats(dealer.dealerId);
        if (own.ok) unread = own.chats.reduce((total, chat) => total + chat.unread, 0);
        offers = dealerBook(dealer).offers.filter((offer) => offer.status === "Pending").length;
      } else {
        const buyer = await listBuyerChats();
        if (buyer.ok) unread = buyer.chats.reduce((total, chat) => total + chat.unread, 0);
        offers = listOffers().filter(
          (offer) => offer.status === "Pending" || offer.status === "Counter Offer",
        ).length;
      }

      if (cancelled) return;
      notifyDashboardDigest({ unread, offers, side: dealer ? "dealer" : "buyer" });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
