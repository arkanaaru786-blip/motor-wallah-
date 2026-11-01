import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Inbox, MessageSquare, Store, Tag } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ChatThreadView, SELLER_QUICK_REPLIES } from "@/components/chat/ChatThreadView";
import { useCustomerSession, maskMobile } from "@/lib/account-store";
import { buyListingName, getBuyListing, lakhLabel } from "@/lib/buy-catalog";
import { chatThreads, subscribeToChat, type ChatThread } from "@/lib/listing-chat";

const TITLE = "Seller Desk — Buyer Chats | Motor Wallah";
const DESCRIPTION =
  "The seller side of every Motor Wallah vehicle conversation: read buyer enquiries, reply once and keep the whole thread in one inbox.";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { chat?: string | undefined } => ({
    chat: typeof search["chat"] === "string" ? search["chat"] : undefined,
  }),
  component: SellerDeskPage,
});

const when = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function SellerDeskPage() {
  const { ready, customer } = useCustomerSession();
  const { chat } = Route.useSearch();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => {
      setThreads(chatThreads("seller"));
      setLoaded(true);
    };
    sync();
    return subscribeToChat(sync);
  }, []);

  const activeId = chat ?? threads[0]?.listingId ?? null;
  const active = useMemo(
    () => threads.find((t) => t.listingId === activeId) ?? null,
    [activeId, threads],
  );
  const listing = active ? getBuyListing(active.listingId) : undefined;
  const unread = threads.reduce((total, thread) => total + thread.unread, 0);

  if (!ready) {
    return (
      <div className="mw-sell mw-seller">
        <SiteHeader pills />
        <main className="mw-acct-main">
          <div className="home-container">
            <p className="mw-seller-loading">Opening your seller desk…</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // The desk belongs to a signed-in seller, exactly like the buyer dashboard.
  if (!customer) return <Navigate to="/login" replace />;

  return (
    <div className="mw-sell mw-seller">
      <SiteHeader pills />
      <main className="mw-acct-main" data-testid="seller-desk">
        <div className="home-container">
          <header className="mw-seller-hero">
            <div>
              <p className="mw-sell-hero-kicker">
                <span /> Dealer dashboard
              </p>
              <h1 className="mw-sell-hero-title">
                Seller <em>Desk</em>
              </h1>
              <p className="mw-seller-hero-sub">
                {customer.name} · {maskMobile(customer.mobile)} — every buyer conversation on this
                device in one inbox.
              </p>
            </div>
            <div className="mw-seller-stats">
              <div className="mw-seller-stat">
                <span className="mw-seller-stat-value">{threads.length}</span>
                <span className="mw-seller-stat-label">Conversations</span>
              </div>
              <div className="mw-seller-stat" data-testid="seller-unread">
                <span className="mw-seller-stat-value">{unread}</span>
                <span className="mw-seller-stat-label">Unread</span>
              </div>
              <Link
                to="/account"
                search={{ tab: "chats" }}
                className="mw-seller-switch"
                data-testid="seller-to-buyer"
              >
                <ArrowLeft size={14} aria-hidden="true" /> Buyer chats
              </Link>
            </div>
          </header>

          {!loaded ? (
            <p className="mw-acct-note">Loading conversations…</p>
          ) : threads.length === 0 ? (
            <div className="mw-seller-empty" data-testid="seller-empty">
              <Inbox size={26} aria-hidden="true" />
              <p className="mw-acct-empty-title">No buyer messages yet</p>
              <p className="mw-acct-empty-text">
                Open any vehicle, start a chat from the “Contact Seller” button, then come back here
                to answer it as the seller.
              </p>
              <Link to="/buy" className="mw-acct-cta mw-acct-cta--inline">
                Browse vehicles <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mw-seller-grid">
              <ul className="mw-seller-list" data-testid="seller-list">
                {threads.map((thread) => {
                  const threadListing = getBuyListing(thread.listingId);
                  const name = threadListing ? buyListingName(threadListing) : thread.listingId;
                  const preview = thread.lastMessage;
                  return (
                    <li key={thread.listingId}>
                      <Link
                        to="/seller"
                        search={{ chat: thread.listingId }}
                        className="mw-seller-thread"
                        data-testid="seller-thread"
                        data-chat-id={thread.listingId}
                        data-active={thread.listingId === activeId ? "true" : "false"}
                      >
                        <span className="mw-seller-thread-avatar" aria-hidden="true">
                          {threadListing?.images[0] ? (
                            <img src={threadListing.images[0]} alt="" width={80} height={56} />
                          ) : (
                            <Store size={16} />
                          )}
                        </span>
                        <span className="mw-seller-thread-main">
                          <span className="mw-seller-thread-name">{name}</span>
                          <span className="mw-seller-thread-preview">
                            {preview.role === "seller" ? "You: " : ""}
                            {preview.body}
                          </span>
                        </span>
                        <span className="mw-seller-thread-side">
                          <span className="mw-seller-thread-time">{when(thread.lastAt)}</span>
                          {thread.unread > 0 ? (
                            <span className="mw-seller-badge" data-testid="seller-unread-badge">
                              {thread.unread}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mw-seller-window" data-testid="seller-window">
                {listing && active ? (
                  <>
                    <header className="mw-chat-head mw-chat-head--desk">
                      <span className="mw-chat-avatar" aria-hidden="true">
                        <img src={listing.images[0]} alt="" width={96} height={64} />
                      </span>
                      <span className="mw-chat-head-text">
                        <span className="mw-chat-head-title">{buyListingName(listing)}</span>
                        <span className="mw-chat-head-sub">
                          {lakhLabel(listing.priceLakh)} · {listing.city} · {listing.categoryLabel}
                        </span>
                        <span className="mw-chat-head-status">
                          <i aria-hidden="true" /> You are replying as the seller
                        </span>
                      </span>
                      <Link
                        to="/buy/vehicle/$id"
                        params={{ id: listing.id }}
                        className="mw-seller-open"
                        data-testid="seller-open-listing"
                      >
                        <Tag size={14} aria-hidden="true" /> Listing
                      </Link>
                    </header>

                    <ChatThreadView
                      listing={listing}
                      role="seller"
                      quickReplies={SELLER_QUICK_REPLIES}
                      height="tall"
                    />
                  </>
                ) : (
                  <div className="mw-seller-placeholder">
                    <MessageSquare size={22} aria-hidden="true" />
                    <p>Select a conversation to read and reply.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
