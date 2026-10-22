import { useCallback, useEffect, useState } from "react";

/**
 * Listing conversations for the in-site enquiry interface.
 *
 * IMPORTANT: there is no messaging backend in this project yet. Threads are
 * stored on the visitor's own device only, and the UI says so. Nothing here
 * pretends that a seller received a message.
 */
export type ChatMessage = {
  id: string;
  listingId: string;
  body: string;
  createdAt: string;
};

const KEY = "mw_listing_chat";

type Threads = Record<string, ChatMessage[]>;

function readThreads(): Threads {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Threads) : {};
  } catch {
    return {};
  }
}

function writeThreads(threads: Threads) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    /* storage unavailable — chat UI must never break */
  }
}

export function useListingThread(listingId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages(readThreads()[listingId] ?? []);
  }, [listingId]);

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      const threads = readThreads();
      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        listingId,
        body: text.slice(0, 1000),
        createdAt: new Date().toISOString(),
      };
      const next = [...(threads[listingId] ?? []), message];
      threads[listingId] = next.slice(-50);
      writeThreads(threads);
      setMessages(threads[listingId]!);
    },
    [listingId],
  );

  return { messages, send };
}
