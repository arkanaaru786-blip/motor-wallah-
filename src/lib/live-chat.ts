/**
 * Buyer ↔ dealer chat, stored in Supabase.
 *
 * Both sides talk to the same three tables (`chats`, `messages`,
 * `dealer_claims` — see supabase/chat.sql). The browser only ever holds the
 * publishable key: who may read or write a row is decided by RLS from the
 * visitor's anonymous Supabase session, so a dealer's claim is what grants the
 * dealer side its access, never a value the page sends.
 *
 * Live delivery uses a Supabase Realtime channel per conversation. A 5-second
 * poll runs alongside it, so a project without realtime enabled (or a dropped
 * socket) still behaves like chat instead of going silent.
 */
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureDealers, listDealers } from "@/lib/dealers";
import { startCloudSync } from "@/lib/cloud-store";
import { describeSupabaseError, supabaseClient } from "@/lib/supabase";

export const MAX_MESSAGE_LENGTH = 1000;
export const POLL_INTERVAL_MS = 5000;

export type ChatSide = "buyer" | "dealer";

export type LiveMessage = {
  id: string;
  chatId: string;
  senderId: string;
  /** Who sent it. The UI calls the dealer side "seller" for the vehicle chat. */
  role: ChatSide;
  text: string;
  isRead: boolean;
  createdAt: string;
};

export type ChatSummary = {
  id: string;
  dealerId: string;
  dealerName: string;
  vehicleId: string;
  vehicleLabel: string;
  buyerName: string;
  buyerMobile: string;
  lastMessageAt: string;
  lastMessage: string;
  lastSenderRole: ChatSide | null;
  unread: number;
};

/** Shown when the schema has not been applied to the project yet. */
export const CHAT_NOT_SET_UP =
  "Chat is not switched on yet. Run supabase/chat.sql in the Supabase SQL editor, then reload.";

type Ready = { client: SupabaseClient; userId: string };
type Failure = { error: string };

const isMissingSchema = (error: unknown): boolean => {
  const candidate = error as { code?: string; message?: string } | null;
  const message = candidate?.message?.toLowerCase() ?? "";
  return (
    candidate?.code === "42P01" ||
    candidate?.code === "42883" ||
    candidate?.code === "PGRST202" ||
    message.includes("could not find the table") ||
    message.includes("could not find the function") ||
    message.includes("does not exist")
  );
};

let signIn: Promise<void> | null = null;

/**
 * The visitor's anonymous session, created on first use. Everything below needs
 * a real `auth.uid()`, so this has to settle before any query runs.
 */
async function ready(): Promise<Ready | Failure> {
  if (typeof window === "undefined") return { error: CHAT_NOT_SET_UP };
  const client = supabaseClient();
  if (!client) return { error: "Chat needs a connection. Check your network and try again." };

  await startCloudSync();
  const { data } = await client.auth.getSession();
  let userId = data.session?.user.id ?? null;

  if (!userId) {
    signIn ??= client.auth
      .signInAnonymously()
      .then(() => undefined)
      .catch(() => undefined);
    await signIn;
    signIn = null;
    const retry = await client.auth.getSession();
    userId = retry.data.session?.user.id ?? null;
  }

  if (!userId) return { error: "Could not sign this browser in for chat. Reload and try again." };
  return { client, userId };
}

const fail = (error: unknown): Failure => ({
  error: isMissingSchema(error) ? CHAT_NOT_SET_UP : describeSupabaseError(error),
});

/* ----------------------------------------------------------------- dealers */

/**
 * The dealer account a listing belongs to.
 *
 * There is one dealer per vehicle category in this build (the same rule the
 * dealer portal enforces), so the listing's category is what decides who the
 * buyer is talking to.
 */
export async function dealerForCategory(categoryId: string): Promise<{ id: string; name: string }> {
  await ensureDealers();
  const dealer = listDealers().find(
    (row) => row.category === categoryId && row.status === "Active",
  );
  return dealer
    ? { id: dealer.id, name: dealer.showroom }
    : { id: `DLR-${categoryId.toUpperCase()}`, name: "Motor Wallah Dealer" };
}

/* ------------------------------------------------------------------ buying */

export type OpenChatInput = {
  dealerId: string;
  dealerName: string;
  vehicleId: string;
  vehicleLabel: string;
  buyerName?: string;
  buyerMobile?: string;
};

export type OpenChatResult = { ok: true; chatId: string } | { ok: false; error: string };

/** Open the buyer's conversation about one vehicle, creating it on first use. */
export async function openBuyerChat(input: OpenChatInput): Promise<OpenChatResult> {
  const session = await ready();
  if ("error" in session) return { ok: false, error: session.error };

  const { data, error } = await session.client.rpc("open_chat", {
    p_dealer_id: input.dealerId,
    p_dealer_name: input.dealerName,
    p_vehicle_id: input.vehicleId,
    p_vehicle_label: input.vehicleLabel,
    p_buyer_name: input.buyerName ?? "",
    p_buyer_mobile: input.buyerMobile ?? "",
  });

  if (error) return { ok: false, error: fail(error).error };
  if (typeof data !== "string")
    return { ok: false, error: "The conversation could not be opened." };
  return { ok: true, chatId: data };
}

/** Dealer ids this browser has already claimed, so polling costs one call fewer. */
const claimed = new Set<string>();

/** Record that this browser speaks for a dealer account. */
export async function claimDealer(dealerId: string, dealerName = ""): Promise<boolean> {
  const session = await ready();
  if ("error" in session) return false;
  if (claimed.has(`${session.userId}:${dealerId}`)) return true;
  const { error } = await session.client.rpc("claim_dealer", {
    p_dealer_id: dealerId,
    p_dealer_name: dealerName,
  });
  if (error) {
    // Chat not set up is not an error the portal should shout about.
    return false;
  }
  claimed.add(`${session.userId}:${dealerId}`);
  return true;
}

/* ---------------------------------------------------------------- messages */

const toMessage = (row: Record<string, unknown>): LiveMessage => ({
  id: String(row["id"]),
  chatId: String(row["chat_id"]),
  senderId: String(row["sender_id"]),
  role: row["sender_role"] === "dealer" ? "dealer" : "buyer",
  text: String(row["message_text"] ?? ""),
  isRead: Boolean(row["is_read"]),
  createdAt: String(row["created_at"] ?? new Date().toISOString()),
});

export async function loadMessages(
  chatId: string,
): Promise<{ ok: true; messages: LiveMessage[] } | { ok: false; error: string }> {
  const session = await ready();
  if ("error" in session) return { ok: false, error: session.error };

  const { data, error } = await session.client
    .from("messages")
    .select("id, chat_id, sender_id, sender_role, message_text, is_read, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) return { ok: false, error: fail(error).error };
  return { ok: true, messages: (data ?? []).map(toMessage) };
}

export async function sendChatMessage(
  chatId: string,
  text: string,
): Promise<{ ok: true; message: LiveMessage } | { ok: false; error: string }> {
  const body = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!body) return { ok: false, error: "Type a message first." };

  const session = await ready();
  if ("error" in session) return { ok: false, error: session.error };

  const { data, error } = await session.client.rpc("send_chat_message", {
    p_chat_id: chatId,
    p_message_text: body,
  });

  if (error) return { ok: false, error: fail(error).error };
  if (!data) return { ok: false, error: "Your message could not be saved. Please retry." };
  return { ok: true, message: toMessage(data as Record<string, unknown>) };
}

export async function markChatRead(chatId: string): Promise<void> {
  const session = await ready();
  if ("error" in session) return;
  await session.client.rpc("mark_chat_read", { p_chat_id: chatId });
}

/* ------------------------------------------------------------- inbox lists */

const toSummary = (row: Record<string, unknown>): ChatSummary => ({
  id: String(row["id"]),
  dealerId: String(row["dealer_id"] ?? ""),
  dealerName: String(row["dealer_name"] ?? ""),
  vehicleId: String(row["vehicle_id"] ?? ""),
  vehicleLabel: String(row["vehicle_label"] ?? ""),
  buyerName: String(row["buyer_name"] ?? ""),
  buyerMobile: String(row["buyer_mobile"] ?? ""),
  lastMessageAt: String(row["last_message_at"] ?? new Date().toISOString()),
  lastMessage: String(row["last_message"] ?? ""),
  lastSenderRole:
    row["last_sender_role"] === "dealer"
      ? "dealer"
      : row["last_sender_role"] === "buyer"
        ? "buyer"
        : null,
  unread: Number(row["unread"] ?? 0),
});

export type InboxResult = { ok: true; chats: ChatSummary[] } | { ok: false; error: string };

export async function listBuyerChats(): Promise<InboxResult> {
  const session = await ready();
  if ("error" in session) return { ok: false, error: session.error };
  const { data, error } = await session.client.rpc("my_chats");
  if (error) return { ok: false, error: fail(error).error };
  return { ok: true, chats: (data ?? []).map(toSummary) };
}

export async function listDealerChats(dealerId: string): Promise<InboxResult> {
  const session = await ready();
  if ("error" in session) return { ok: false, error: session.error };
  // Reading a dealer's inbox requires the claim, so make sure it exists first.
  await claimDealer(dealerId);
  const { data, error } = await session.client.rpc("dealer_chats", { p_dealer_id: dealerId });
  if (error) return { ok: false, error: fail(error).error };
  return { ok: true, chats: (data ?? []).map(toSummary) };
}

/* ------------------------------------------------------------------- hooks */

/**
 * New messages for one conversation: realtime when it works, a poll when it
 * does not. Returns an unsubscribe for the effect.
 */
function watchChat(chatId: string, onChange: () => void): () => void {
  const client = supabaseClient();
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;

  if (client) {
    channel = client
      .channel(`mw-chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        onChange,
      )
      .subscribe();
  }

  const poll = window.setInterval(onChange, POLL_INTERVAL_MS);
  return () => {
    window.clearInterval(poll);
    if (channel && client) void client.removeChannel(channel);
  };
}

export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(chatId));
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef(chatId);
  chatRef.current = chatId;

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const sync = async () => {
      const result = await loadMessages(chatId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        setError(null);
        setMessages((current) => {
          // Nothing changed since the last poll: keep the same array so the
          // message list does not re-render (and re-scroll) every five seconds.
          if (
            current.length === result.messages.length &&
            current.at(-1)?.id === result.messages.at(-1)?.id
          ) {
            return current;
          }
          return result.messages;
        });
        void markChatRead(chatId);
      }
      setLoading(false);
    };

    void sync();
    const stop = watchChat(chatId, () => void sync());
    return () => {
      cancelled = true;
      stop();
    };
  }, [chatId]);

  const send = async (text: string) => {
    if (!chatRef.current) return false;
    const result = await sendChatMessage(chatRef.current, text);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setMessages((current) =>
      current.some((row) => row.id === result.message.id) ? current : [...current, result.message],
    );
    return true;
  };

  return { messages, loading, error, send, reload: () => void loadMessages(chatId ?? "") };
}

/** Buyer inbox (no dealer id) or a dealer's inbox (with one). */
export function useChatInbox(side: ChatSide, dealerId?: string) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const result =
        side === "dealer"
          ? dealerId
            ? await listDealerChats(dealerId)
            : { ok: true as const, chats: [] }
          : await listBuyerChats();
      if (cancelled) return;
      if (result.ok) {
        setChats(result.chats);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    void sync();
    const poll = window.setInterval(sync, POLL_INTERVAL_MS * 3);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [side, dealerId]);

  return {
    chats,
    loading,
    error,
    unread: chats.reduce((total, chat) => total + chat.unread, 0),
  };
}

/** Total unread for the red badge, without rendering the whole inbox. */
export function useUnreadChats(side: ChatSide, dealerId?: string): number {
  const { unread } = useChatInbox(side, dealerId);
  return unread;
}
