import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, Send, Sparkles } from "lucide-react";
import { buyListingName, rupees, type BuyListing } from "@/lib/buy-catalog";
import { MAX_MESSAGE_LENGTH, useChatThread } from "@/lib/listing-chat";

export type QuickReply = { label: string; body: string };

/** The pre-filled openers offered before the buyer types anything. */
export const BUYER_QUICK_REPLIES: QuickReply[] = [
  { label: "Is this vehicle still available?", body: "Is this vehicle still available?" },
  { label: "Can I get more photos?", body: "Can you share a few more photos of the vehicle?" },
  { label: "What is the final price?", body: "What is your best price for this vehicle?" },
  {
    label: "Can I schedule a visit?",
    body: "I would like to visit and see the vehicle. When can I come?",
  },
];

export const SELLER_QUICK_REPLIES: QuickReply[] = [
  {
    label: "Yes, it's available",
    body: "Yes, the vehicle is available. When would you like to visit?",
  },
  {
    label: "Share a test drive slot",
    body: "Sure — I can arrange a test drive at a time that suits you.",
  },
  {
    label: "Price is negotiable",
    body: "The price is slightly negotiable for a serious buyer. Shall we talk?",
  },
];

const timeLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * Shared message list + composer for the vehicle chat and the Seller Desk.
 * Buyer/seller wording flips with `role`, so both sides read one thread.
 */
export function ChatThreadView({
  listing,
  role,
  quickReplies,
  note,
  height = "default",
  onFirstMessage,
}: {
  listing: BuyListing;
  role: "buyer" | "seller";
  quickReplies: QuickReply[];
  note?: string;
  height?: "default" | "tall";
  /** Fires once, with the opening message of a brand-new thread. */
  onFirstMessage?: (body: string) => void;
}) {
  const { messages, send, typing } = useChatThread(listing.id, role);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const vehicle = buyListingName(listing);
  const price = rupees(Math.round(listing.priceLakh * 100000));

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, typing, scrollToEnd]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = (body: string) => {
    const opening = messages.length === 0;
    if (!send(body)) return;
    setDraft("");
    inputRef.current?.focus();
    if (opening) onFirstMessage?.(body.trim());
  };

  const hasQuickReply = (body: string) => messages.some((message) => message.body === body);

  let lastDay = "";

  return (
    <div className="mw-chat" data-role={role} data-testid="chat">
      <div
        className={`mw-chat-thread${height === "tall" ? " mw-chat-thread--tall" : ""}`}
        data-testid="chat-messages"
        aria-live="polite"
        aria-label={`Conversation about ${vehicle}`}
      >
        {messages.length === 0 ? (
          <div className="mw-chat-empty" data-testid="chat-empty">
            <span className="mw-chat-empty-icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <p className="mw-chat-empty-title">
              {role === "buyer" ? "Start the conversation" : "No messages yet"}
            </p>
            <p className="mw-chat-empty-text">
              {role === "buyer"
                ? `Say hello to the ${listing.model} seller. Pick an opener below or type your own question.`
                : "This buyer has not written yet. Replies you send appear in their My Chats."}
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const day = dayLabel(message.createdAt);
          const showDay = day && day !== lastDay;
          if (showDay) lastDay = day;
          const mine = message.role === role;
          return (
            <div key={message.id} className="mw-chat-block">
              {showDay ? <p className="mw-chat-day">{day}</p> : null}
              <div
                className={`mw-chat-row ${mine ? "mw-chat-row--out" : "mw-chat-row--in"}${
                  message.role === "system" ? " mw-chat-row--system" : ""
                }`}
              >
                <div
                  className={`mw-chat-bubble ${mine ? "mw-chat-bubble--out" : "mw-chat-bubble--in"}${
                    message.role === "system" ? " mw-chat-bubble--system" : ""
                  }`}
                  data-testid="chat-bubble"
                  data-role={message.role}
                >
                  {message.role === "seller" || message.role === "system" ? (
                    <span className="mw-chat-author">
                      {message.role === "seller" ? `${listing.model} Seller` : "Motor Wallah"}
                    </span>
                  ) : null}
                  <p>{message.body}</p>
                  <span className="mw-chat-meta">
                    {timeLabel(message.createdAt)}
                    {mine ? <CheckCheck size={12} aria-hidden="true" /> : null}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {typing ? (
          <div className="mw-chat-row mw-chat-row--in" data-testid="chat-typing">
            <div className="mw-chat-bubble mw-chat-bubble--in mw-chat-bubble--typing">
              <span className="mw-chat-author">{listing.model} Seller</span>
              <span className="mw-chat-dots" aria-label="Seller is typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {quickReplies.length > 0 ? (
        <div className="mw-chat-quick" role="group" aria-label="Quick replies">
          {quickReplies
            .filter((reply) => !hasQuickReply(reply.body))
            .slice(0, 3)
            .map((reply) => (
              <button
                key={reply.label}
                type="button"
                className="mw-chat-chip"
                data-testid="chat-quick-reply"
                onClick={() => submit(reply.body)}
              >
                {reply.label}
              </button>
            ))}
        </div>
      ) : null}

      <form
        className="mw-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label className="mw-chat-field">
          <span className="sr-only">Your message</span>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={role === "buyer" ? "Write to the seller…" : "Reply to the buyer…"}
            data-testid="chat-input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(draft);
              }
            }}
          />
        </label>
        <button
          type="submit"
          className="mw-chat-send"
          data-testid="chat-send"
          disabled={!draft.trim()}
          aria-label="Send message"
        >
          <Send size={16} aria-hidden="true" />
          <span>Send</span>
        </button>
      </form>

      <p className="mw-chat-note">
        {note ??
          (role === "buyer"
            ? `Saved on this device — the ${listing.model} seller reads it in their Seller Desk.`
            : `Replies reach the buyer's My Chats instantly. ${price} asking price on this ${vehicle}.`)}
      </p>
    </div>
  );
}
