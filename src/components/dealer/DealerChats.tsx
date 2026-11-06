import { useState } from "react";
import { Inbox, MessageSquare } from "lucide-react";

import { ChatThreadView, SELLER_QUICK_REPLIES } from "@/components/chat/ChatThreadView";
import { maskMobile } from "@/lib/account-store";
import { getBuyListing } from "@/lib/buy-catalog";
import { dealerCategoryLabel } from "@/lib/dealer-categories";
import type { DealerSession } from "@/lib/dealer-session";
import { useChatInbox } from "@/lib/live-chat";

/**
 * The dealer's side of every buyer conversation.
 *
 * The list is `dealer_chats(dealer_id)` — one row per buyer and vehicle, newest
 * first, with the buyer's unread count. Selecting a row opens the same stored
 * thread the buyer is reading, so a reply appears on their page immediately.
 */
export function DealerChats({ session }: { session: DealerSession }) {
  const { chats, loading, error, unread } = useChatInbox("dealer", session.dealerId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = selectedId ?? chats[0]?.id ?? null;
  const active = chats.find((chat) => chat.id === activeId) ?? null;
  const listing = active ? getBuyListing(active.vehicleId) : undefined;

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>My Chats</h1>
          <p>
            {unread > 0
              ? `${unread} unread ${unread === 1 ? "message" : "messages"} from buyers on your listings.`
              : `Buyers who messaged you about a vehicle in your ${dealerCategoryLabel(session.category).toLowerCase()} inventory.`}
          </p>
        </div>
      </div>

      <section className="mw-dealer-panel is-wide" data-testid="dealer-chats">
        <div className="mw-dealer-panel-head">
          <div>
            <h2>
              <MessageSquare size={15} /> Buyer conversations ({chats.length})
            </h2>
            <p>Newest first, with the vehicle each buyer is asking about.</p>
          </div>
        </div>

        {loading ? (
          <p className="mw-dealer-empty">Loading your conversations…</p>
        ) : error ? (
          <p className="mw-dealer-empty" role="alert" data-testid="dealer-chats-error">
            {error}
          </p>
        ) : chats.length === 0 ? (
          <p className="mw-dealer-empty" data-testid="dealer-chats-empty">
            <Inbox size={22} aria-hidden="true" /> No buyer chats yet — every “Chat with seller”
            enquiry on a {session.category} listing appears here with the vehicle in question.
          </p>
        ) : (
          <div className="mw-acct-chat">
            <ul className="mw-acct-chat-list" data-testid="dealer-chat-list">
              {chats.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    className="mw-acct-chat-thread"
                    data-testid="dealer-chat-thread"
                    data-chat-id={chat.id}
                    data-unread={chat.unread}
                    data-active={chat.id === activeId ? "true" : "false"}
                    onClick={() => setSelectedId(chat.id)}
                  >
                    <span className="mw-acct-chat-avatar" aria-hidden="true">
                      {(chat.buyerName || "B").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="mw-acct-chat-thread-main">
                      <span className="mw-acct-chat-name">{chat.buyerName || "Buyer"}</span>
                      <span className="mw-acct-chat-preview">
                        {chat.vehicleLabel || chat.vehicleId}
                        {chat.lastMessage ? ` · ${chat.lastMessage}` : ""}
                      </span>
                    </span>
                    {chat.unread > 0 ? (
                      <span className="mw-chat-badge" data-testid="dealer-chat-badge">
                        {chat.unread}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mw-acct-chat-window" data-testid="dealer-chat-window">
              {active ? (
                <>
                  <div className="mw-acct-chat-head">
                    <span className="mw-acct-chat-avatar" aria-hidden="true">
                      {(active.buyerName || "B").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="mw-acct-chat-head-text">
                      <span className="mw-acct-chat-name">
                        {active.buyerName || "Buyer"}
                        {active.buyerMobile ? ` · ${maskMobile(active.buyerMobile)}` : ""}
                      </span>
                      <span className="mw-acct-chat-status">
                        {active.vehicleLabel || active.vehicleId} · buyer enquiry
                      </span>
                    </span>
                  </div>

                  {listing ? (
                    <ChatThreadView
                      listing={listing}
                      chatId={active.id}
                      role="seller"
                      quickReplies={SELLER_QUICK_REPLIES}
                    />
                  ) : (
                    <p className="mw-acct-chat-hint">
                      <MessageSquare size={14} aria-hidden="true" /> This vehicle is no longer in
                      the catalogue, so the conversation cannot be shown.
                    </p>
                  )}
                </>
              ) : (
                <p className="mw-acct-chat-hint">Select a conversation to reply.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
