import { useCallback, useEffect, useState } from "react";

/**
 * Buyer ↔ seller conversations for one vehicle listing.
 *
 * There is no messaging server in this project, so a thread lives in this
 * browser's storage. That still makes it genuinely two-way: the buyer writes
 * from a vehicle page, the seller reads and replies from the Seller Desk, and
 * both sides render the same stored thread. The seller's first reply is
 * simulated three seconds after the buyer's message, as specified.
 */

export type ChatRole = "buyer" | "seller" | "system";

export type ChatMessage = {
  id: string;
  listingId: string;
  role: ChatRole;
  body: string;
  createdAt: string;
};

export type ChatThread = {
  listingId: string;
  messages: ChatMessage[];
  lastAt: string;
  lastMessage: ChatMessage;
  /** Messages from the other side that this role has not opened yet. */
  unread: number;
};

const THREADS_KEY = "mw_listing_chat";
const READ_KEY = "mw_chat_read";
const PENDING_KEY = "mw_chat_pending";
const MAX_PER_THREAD = 80;

export const SELLER_REPLY_DELAY_MS = 3000;
export const MAX_MESSAGE_LENGTH = 1000;

/** The first reply is the one the brief specifies; later ones keep a thread alive. */
const SELLER_REPLIES = [
  "Yes, the vehicle is available. When would you like to visit?",
  "Sure — I can arrange a test drive at a time that suits you.",
  "The price is slightly negotiable for a serious buyer. Shall we talk?",
  "I can share the service history and inspection report before your visit.",
  "Happy to help. Which day works best for you this week?",
];

type Threads = Record<string, ChatMessage[]>;
type ReadState = Record<string, Partial<Record<ChatRole, string>>>;
type Pending = Record<string, string>;

const listeners = new Set<() => void>();
const timers = new Map<string, number>();
let bridgeBound = false;

/* ------------------------------------------------------------------ storage */

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked — chat UI must never crash */
  }
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a broken subscriber must not break the others */
    }
  });
}

/** Re-render on every thread change, including changes made in another tab. */
export function subscribeToChat(listener: () => void) {
  listeners.add(listener);
  if (!bridgeBound && typeof window !== "undefined") {
    bridgeBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key === THREADS_KEY || event.key === READ_KEY || event.key === PENDING_KEY) {
        notify();
      }
    });
  }
  resumePendingReplies();
  return () => {
    listeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ threads */

/** Older records were buyer messages without a role; keep them readable. */
function normalise(message: ChatMessage): ChatMessage {
  return message.role ? message : { ...message, role: "buyer" };
}

function readThreads(): Threads {
  const raw = readJson<Threads>(THREADS_KEY, {});
  if (!raw || typeof raw !== "object") return {};
  const clean: Threads = {};
  for (const [listingId, messages] of Object.entries(raw)) {
    if (!Array.isArray(messages)) continue;
    clean[listingId] = messages
      .filter((message) => typeof message?.body === "string" && message.body.length > 0)
      .map(normalise);
  }
  return clean;
}

function readState(): ReadState {
  const raw = readJson<ReadState>(READ_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

function readPending(): Pending {
  const raw = readJson<Pending>(PENDING_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

export function getThread(listingId: string): ChatMessage[] {
  return readThreads()[listingId] ?? [];
}

export function chatThreads(role: Exclude<ChatRole, "system"> = "buyer"): ChatThread[] {
  const threads = readThreads();
  const state: Record<string, string> = readState()[role] ?? {};
  return Object.entries(threads)
    .map(([listingId, messages]) => {
      const lastMessage = messages.at(-1)!;
      const lastRead = state[listingId];
      const unread = messages.filter(
        (message) =>
          message.role !== role &&
          message.role !== "system" &&
          (!lastRead || message.createdAt > lastRead),
      ).length;
      return { listingId, messages, lastAt: lastMessage.createdAt, lastMessage, unread };
    })
    .filter((thread) => thread.messages.length > 0)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export function unreadChats(role: Exclude<ChatRole, "system">): number {
  return chatThreads(role).reduce((total, thread) => total + thread.unread, 0);
}

export function markRead(listingId: string, role: Exclude<ChatRole, "system">) {
  if (typeof window === "undefined") return;
  const state = readState();
  const next = { ...(state[role] ?? {}), [listingId]: new Date().toISOString() };
  writeJson(READ_KEY, { ...state, [role]: next });
}

/* ------------------------------------------------------------------ writing */

export function sendChatMessage(
  listingId: string,
  role: ChatRole,
  body: string,
): ChatMessage | null {
  const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return null;
  const threads = readThreads();
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    listingId,
    role,
    body: text,
    createdAt: new Date().toISOString(),
  };
  threads[listingId] = [...(threads[listingId] ?? []), message].slice(-MAX_PER_THREAD);
  writeJson(THREADS_KEY, threads);
  markRead(listingId, role === "seller" ? "seller" : "buyer");
  if (role === "buyer") scheduleSellerReply(listingId);
  if (role === "seller") cancelSellerReply(listingId);
  notify();
  return message;
}

/* ------------------------------------------------------- simulated seller */

function nextSellerReply(listingId: string): string {
  const replies = getThread(listingId).filter((message) => message.role === "seller").length;
  return SELLER_REPLIES[Math.min(replies, SELLER_REPLIES.length - 1)]!;
}

function scheduleSellerReply(listingId: string) {
  if (typeof window === "undefined") return;
  const pending = readPending();
  pending[listingId] = new Date(Date.now() + SELLER_REPLY_DELAY_MS).toISOString();
  writeJson(PENDING_KEY, pending);
  const existing = timers.get(listingId);
  if (existing) window.clearTimeout(existing);
  timers.set(
    listingId,
    window.setTimeout(() => deliverSellerReply(listingId), SELLER_REPLY_DELAY_MS),
  );
}

function cancelSellerReply(listingId: string) {
  if (typeof window === "undefined") return;
  const pending = readPending();
  if (!(listingId in pending)) return;
  delete pending[listingId];
  writeJson(PENDING_KEY, pending);
  const timer = timers.get(listingId);
  if (timer) {
    window.clearTimeout(timer);
    timers.delete(listingId);
  }
}

function deliverSellerReply(listingId: string) {
  if (typeof window === "undefined") return;
  const pending = readPending();
  if (!(listingId in pending)) return;
  delete pending[listingId];
  writeJson(PENDING_KEY, pending);
  timers.delete(listingId);
  sendChatMessage(listingId, "seller", nextSellerReply(listingId));
}

/** A reload mid-wait still produces the reply the buyer was promised. */
export function resumePendingReplies() {
  if (typeof window === "undefined") return;
  const pending = readPending();
  for (const [listingId, dueAt] of Object.entries(pending)) {
    if (timers.has(listingId)) continue;
    const remaining = new Date(dueAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      deliverSellerReply(listingId);
      continue;
    }
    timers.set(
      listingId,
      window.setTimeout(() => deliverSellerReply(listingId), Math.min(remaining, 1000)),
    );
  }
}

export function isSellerTyping(listingId: string): boolean {
  const dueAt = readPending()[listingId];
  return Boolean(dueAt) && new Date(dueAt!).getTime() > Date.now();
}

/* -------------------------------------------------------------------- hooks */

/** Messages + live seller typing state for one thread, from either side. */
export function useChatThread(listingId: string, role: Exclude<ChatRole, "system">) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const sync = () => {
      setMessages(getThread(listingId));
      setTyping(isSellerTyping(listingId));
    };
    sync();
    markRead(listingId, role);
    const unsubscribe = subscribeToChat(sync);
    // Typing expires on a timer, not on a message, so poll it while it is live.
    const poll = window.setInterval(sync, 700);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [listingId, role]);

  useEffect(() => {
    if (messages.length > 0) markRead(listingId, role);
  }, [listingId, role, messages.length]);

  const send = useCallback(
    (body: string) => {
      const sent = sendChatMessage(listingId, role, body);
      if (sent) {
        markRead(listingId, role);
        setMessages(getThread(listingId));
        setTyping(isSellerTyping(listingId));
      }
      return Boolean(sent);
    },
    [listingId, role],
  );

  return { messages, send, typing: role === "buyer" ? typing : false };
}
