import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeIndianRupee,
  Check,
  ChevronRight,
  ClipboardList,
  Heart,
  Inbox,
  LogOut,
  MessageSquare,
  Send,
  Store,
  UserRound,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { useCustomerSession, maskMobile, signOut, updateProfile } from "@/lib/account-store";
import type { CustomerProfile } from "@/lib/account-store";
import {
  appendChatMessage,
  chatThreads,
  dashboardCounts,
  ownListings,
  setOwnListingStatus,
  trackedLeads,
  type ChatThread,
  type OwnListing,
  type TrackedLead,
} from "@/lib/account-data";
import { listOffers, type ListingOffer, type OfferStatus } from "@/lib/listing-offers";
import { useShortlist } from "@/lib/shortlist";
import { buyListingName, getBuyListing, lakhLabel, rupees } from "@/lib/buy-catalog";

const TITLE = "My Dashboard — Saved Vehicles, Offers & Leads | Motor Wallah";
const DESCRIPTION =
  "Your Motor Wallah dashboard: profile, saved vehicles, seller chats, offers, your own listings and every finance, insurance, service or franchise application.";

const TABS = [
  { id: "profile", label: "My Profile", blurb: "Name, email, city, mobile", icon: UserRound },
  { id: "saved", label: "Saved Vehicles", blurb: "Vehicles you hearted", icon: Heart },
  { id: "chats", label: "My Chats", blurb: "Seller conversations", icon: MessageSquare },
  { id: "offers", label: "My Offers", blurb: "Offers you have made", icon: BadgeIndianRupee },
  { id: "listings", label: "My Listings", blurb: "Vehicles you listed", icon: Store },
  { id: "leads", label: "My Leads", blurb: "Applications & references", icon: ClipboardList },
] as const;

type AccountTab = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((tab) => tab.id) as string[];

type AccountSearch = { tab?: AccountTab | undefined; chat?: string | undefined };

export const Route = createFileRoute("/account")({
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
  validateSearch: (search: Record<string, unknown>): AccountSearch => {
    const raw = search["tab"];
    const tab = typeof raw === "string" && TAB_IDS.includes(raw) ? (raw as AccountTab) : undefined;
    const chat = typeof search["chat"] === "string" ? search["chat"] : undefined;
    return { tab, chat };
  },
  component: AccountPage,
});

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OFFER_CLASS: Record<OfferStatus, string> = {
  Pending: "buy-offer-badge buy-offer-badge--pending",
  "Counter Offer": "buy-offer-badge buy-offer-badge--counter",
  Accepted: "buy-offer-badge buy-offer-badge--accepted",
  Rejected: "buy-offer-badge buy-offer-badge--rejected",
};

function AccountPage() {
  const { ready, customer } = useCustomerSession();
  const { tab: tabParam, chat } = Route.useSearch();
  const tab = tabParam ?? "profile";
  const [counts, setCounts] = useState({ saved: 0, chats: 0, offers: 0, listings: 0, leads: 0 });

  useEffect(() => {
    setCounts(dashboardCounts());
  }, [tab, customer]);

  if (!ready) {
    return (
      <div className="mw-sell mw-acct">
        <SiteHeader pills />
        <main className="mw-acct-main">
          <div className="home-container">
            <div className="mw-acct-gate" data-testid="account-loading">
              <p className="mw-acct-gate-text">Checking your account…</p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Route protection: no session → the login screen, never the dashboard.
  if (!customer) return <Navigate to="/login" replace />;

  const firstName = customer.name.split(" ")[0] ?? customer.name;

  return (
    <div className="mw-sell mw-acct">
      <SiteHeader pills />
      <main className="mw-acct-main" data-testid="account-dashboard">
        <div className="home-container">
          <header className="mw-acct-hero">
            <div>
              <p className="mw-sell-hero-kicker">
                <span /> My account
              </p>
              <h1 className="mw-sell-hero-title">
                Hello, <em>{firstName}</em>
              </h1>
              <p className="mw-acct-hero-sub">
                {maskMobile(customer.mobile)} · {customer.city} — everything you have done on Motor
                Wallah in one place.
              </p>
            </div>
            <button
              type="button"
              className="mw-acct-ghostbtn"
              data-testid="sign-out"
              onClick={() => signOut()}
            >
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </header>

          <div className="mw-acct-grid">
            <nav className="mw-acct-nav" aria-label="Dashboard sections">
              {TABS.map((item) => {
                const Icon = item.icon;
                const count = item.id === "profile" ? null : counts[item.id];
                return (
                  <Link
                    key={item.id}
                    to="/account"
                    search={{ tab: item.id }}
                    className="mw-acct-nav-btn"
                    data-testid="account-tab"
                    data-tab={item.id}
                    data-active={tab === item.id ? "true" : "false"}
                    aria-current={tab === item.id ? "page" : undefined}
                  >
                    <span className="mw-acct-nav-icon">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="mw-acct-nav-text">
                      <span className="mw-acct-nav-label">{item.label}</span>
                      <span className="mw-acct-nav-blurb">{item.blurb}</span>
                    </span>
                    {count !== null && count > 0 && (
                      <span className="mw-acct-nav-count">{count}</span>
                    )}
                  </Link>
                );
              })}

              <div className="mw-acct-nav-foot">
                <span className="mw-acct-avatar mw-acct-avatar--sm" aria-hidden="true">
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="mw-acct-nav-foot-text">
                  <span className="mw-acct-nav-foot-name">{customer.name}</span>
                  <span className="mw-acct-nav-foot-meta">{maskMobile(customer.mobile)}</span>
                </span>
              </div>
            </nav>

            <section className="mw-acct-panel" data-testid="account-panel" data-panel={tab}>
              {tab === "profile" && <ProfileTab customer={customer} />}
              {tab === "saved" && <SavedTab />}
              {tab === "chats" && <ChatsTab selectedId={chat} />}
              {tab === "offers" && <OffersTab />}
              {tab === "listings" && <ListingsTab />}
              {tab === "leads" && <LeadsTab />}
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}

/* ------------------------------------------------------------- tab: profile */

function ProfileTab({ customer }: { customer: CustomerProfile }) {
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    city: customer.city,
    mobile: customer.mobile,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      name: customer.name,
      email: customer.email,
      city: customer.city,
      mobile: customer.mobile,
    });
  }, [customer]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = updateProfile({ currentMobile: customer.mobile, ...form });
    if (!result.ok) {
      setError(result.error);
      setSaved(false);
      return;
    }
    setError(null);
    setSaved(true);
  };

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Profile</h2>
          <p className="mw-acct-panel-sub">
            These details are used on every enquiry you send from this device.
          </p>
        </div>
        <span className="mw-acct-pill">Customer account</span>
      </div>

      <form className="mw-acct-form" onSubmit={submit} noValidate>
        <div className="mw-acct-field">
          <label className="mw-acct-label" htmlFor="account-name">
            Full name
          </label>
          <input
            id="account-name"
            data-testid="profile-name"
            className="mw-acct-input"
            value={form.name}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value });
              setSaved(false);
              setError(null);
            }}
          />
        </div>
        <div className="mw-acct-field">
          <label className="mw-acct-label" htmlFor="account-mobile">
            Mobile number
          </label>
          <input
            id="account-mobile"
            data-testid="profile-mobile"
            className="mw-acct-input"
            inputMode="numeric"
            maxLength={10}
            value={form.mobile}
            onChange={(event) => {
              setForm({ ...form, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) });
              setSaved(false);
              setError(null);
            }}
          />
        </div>
        <div className="mw-acct-field">
          <label className="mw-acct-label" htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            data-testid="profile-email"
            className="mw-acct-input"
            type="email"
            value={form.email}
            onChange={(event) => {
              setForm({ ...form, email: event.target.value });
              setSaved(false);
              setError(null);
            }}
          />
        </div>
        <div className="mw-acct-field">
          <label className="mw-acct-label" htmlFor="account-city">
            City
          </label>
          <input
            id="account-city"
            data-testid="profile-city"
            className="mw-acct-input"
            value={form.city}
            onChange={(event) => {
              setForm({ ...form, city: event.target.value });
              setSaved(false);
              setError(null);
            }}
          />
        </div>

        <div className="mw-acct-form-foot">
          <button
            type="submit"
            className="mw-acct-cta mw-acct-cta--inline"
            data-testid="save-profile"
          >
            Save changes <Check size={16} aria-hidden="true" />
          </button>
          <p className="mw-acct-note">Member since {formatWhen(customer.createdAt)}</p>
        </div>

        {error && (
          <p className="mw-acct-error" role="alert" data-testid="profile-error">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mw-acct-success" role="status" data-testid="profile-saved">
            Profile updated.
          </p>
        )}
      </form>
    </>
  );
}

/* --------------------------------------------------------------- tab: saved */

function SavedTab() {
  const { ids, ready, toggle } = useShortlist();

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">Saved Vehicles</h2>
          <p className="mw-acct-panel-sub">Every listing you hearted on the Buy page.</p>
        </div>
        <Link to="/buy" className="mw-acct-inline-link">
          Browse vehicles <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {!ready ? (
        <p className="mw-acct-note">Loading your saved vehicles…</p>
      ) : ids.length === 0 ? (
        <div className="mw-acct-empty" data-testid="saved-empty">
          <Heart size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No saved vehicles yet</p>
          <p className="mw-acct-empty-text">
            Tap the heart on any listing and it will appear here — ready to compare or make an
            offer.
          </p>
          <Link to="/buy" className="mw-acct-cta mw-acct-cta--inline">
            Explore the marketplace <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="saved-list">
          {ids.map((id) => {
            const listing = getBuyListing(id);
            return (
              <li key={id} className="mw-acct-row" data-saved-id={id}>
                <span className="mw-acct-thumb">
                  {listing?.images[0] ? (
                    <img src={listing.images[0]} alt="" aria-hidden="true" loading="lazy" />
                  ) : (
                    <Inbox size={18} aria-hidden="true" />
                  )}
                </span>
                <span className="mw-acct-row-main">
                  <span className="mw-acct-row-title">
                    {listing ? buyListingName(listing) : "Listing no longer available"}
                  </span>
                  <span className="mw-acct-row-meta">
                    {listing
                      ? [
                          lakhLabel(listing.priceLakh),
                          listing.year,
                          listing.kilometres !== null
                            ? `${listing.kilometres.toLocaleString("en-IN")} km`
                            : null,
                          listing.city,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "This vehicle is no longer in the catalogue."}
                  </span>
                </span>
                <span className="mw-acct-row-actions">
                  {listing && (
                    <Link
                      to="/buy/vehicle/$id"
                      params={{ id: listing.id }}
                      className="mw-acct-row-link"
                    >
                      View <ChevronRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                  <button
                    type="button"
                    className="mw-acct-iconbtn"
                    aria-label={
                      listing
                        ? `Remove ${buyListingName(listing)} from saved vehicles`
                        : "Remove saved vehicle"
                    }
                    data-testid="saved-remove"
                    onClick={() => toggle(id)}
                  >
                    <Heart size={16} fill="currentColor" aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* --------------------------------------------------------------- tab: chats */

function ChatsTab({ selectedId }: { selectedId?: string | undefined }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setThreads(chatThreads());
    setLoaded(true);
  }, []);

  const activeId = selectedId ?? threads[0]?.listingId ?? null;
  const active = threads.find((thread) => thread.listingId === activeId) ?? null;
  const listing = active ? getBuyListing(active.listingId) : undefined;

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const result = appendChatMessage(active.listingId, draft);
    if (!result.ok) {
      setError(result.error ?? "Your message could not be saved.");
      return;
    }
    setDraft("");
    setError(null);
    setThreads(chatThreads());
  };

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Chats</h2>
          <p className="mw-acct-panel-sub">
            Conversations you started with sellers from a listing.
          </p>
        </div>
      </div>

      {!loaded ? (
        <p className="mw-acct-note">Loading your chats…</p>
      ) : threads.length === 0 ? (
        <div className="mw-acct-empty" data-testid="chats-empty">
          <MessageSquare size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No seller chats yet</p>
          <p className="mw-acct-empty-text">
            Open any vehicle and use “Chat with seller” — the conversation appears here.
          </p>
          <Link to="/buy" className="mw-acct-cta mw-acct-cta--inline">
            Find a vehicle <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mw-acct-chat">
          <ul className="mw-acct-chat-list" data-testid="chat-list">
            {threads.map((thread) => {
              const threadListing = getBuyListing(thread.listingId);
              const name = threadListing ? buyListingName(threadListing) : thread.listingId;
              return (
                <li key={thread.listingId}>
                  <Link
                    to="/account"
                    search={{ tab: "chats", chat: thread.listingId }}
                    className="mw-acct-chat-thread"
                    data-testid="chat-thread"
                    data-chat-id={thread.listingId}
                    data-active={thread.listingId === activeId ? "true" : "false"}
                  >
                    <span className="mw-acct-chat-avatar" aria-hidden="true">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="mw-acct-chat-thread-main">
                      <span className="mw-acct-chat-name">{name}</span>
                      <span className="mw-acct-chat-preview">
                        {thread.messages.at(-1)?.body ?? ""}
                      </span>
                    </span>
                    <span className="mw-acct-chat-time">{formatWhen(thread.lastAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mw-acct-chat-window" data-testid="chat-window">
            <div className="mw-acct-chat-head">
              <span className="mw-acct-chat-avatar" aria-hidden="true">
                {(listing ? buyListingName(listing) : "S").slice(0, 1).toUpperCase()}
              </span>
              <span className="mw-acct-chat-head-text">
                <span className="mw-acct-chat-name">
                  {listing ? buyListingName(listing) : "Seller"}
                </span>
                <span className="mw-acct-chat-status">Motor Wallah seller desk · demo chat</span>
              </span>
            </div>

            <div className="mw-acct-chat-body">
              {active?.messages.length ? (
                active.messages.map((message) => (
                  <p key={message.id} className="mw-acct-msg mw-acct-msg--customer">
                    {message.body}
                    <span className="mw-acct-msg-time">{formatWhen(message.createdAt)}</span>
                  </p>
                ))
              ) : (
                <p className="mw-acct-chat-hint">Start the conversation below.</p>
              )}
              <p className="mw-acct-chat-autoreply" data-testid="chat-autoreply">
                This is a demo chat window. Messages are saved on this device only and no seller is
                contacted.
              </p>
            </div>

            <form className="mw-acct-composer" onSubmit={send}>
              <input
                className="mw-acct-input"
                data-testid="chat-input"
                placeholder="Write a message…"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
                aria-label="Message"
              />
              <button type="submit" className="mw-acct-send" data-testid="chat-send">
                <Send size={16} aria-hidden="true" /> Send
              </button>
            </form>
            {error && (
              <p className="mw-acct-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- tab: offers */

function OffersTab() {
  const [offers, setOffers] = useState<ListingOffer[]>([]);
  useEffect(() => {
    setOffers(listOffers());
  }, []);

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Offers</h2>
          <p className="mw-acct-panel-sub">Every offer you have made, with its current status.</p>
        </div>
        <Link to="/buy/offers" className="mw-acct-inline-link">
          Offer tracking <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {offers.length === 0 ? (
        <div className="mw-acct-empty" data-testid="offers-empty">
          <BadgeIndianRupee size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No offers yet</p>
          <p className="mw-acct-empty-text">
            Use “Make an offer” on any listing. Your offers land here with a Pending, Counter Offer
            or Accepted badge.
          </p>
          <Link to="/buy" className="mw-acct-cta mw-acct-cta--inline">
            Find your next vehicle <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="offers-list">
          {offers.map((offer) => (
            <li key={offer.id} className="mw-acct-row" data-offer-id={offer.id}>
              <span className="mw-acct-row-main">
                <span className="mw-acct-row-title">
                  {offer.listingName}
                  <span className={OFFER_CLASS[offer.status]} data-testid="offer-status">
                    {offer.status}
                  </span>
                </span>
                <span className="mw-acct-row-meta">
                  {rupees(offer.amount)} · asking {lakhLabel(offer.askingLakh)} ·{" "}
                  {offer.categoryLabel} · {offer.city}
                </span>
                <span className="mw-acct-row-note">Offered on {formatWhen(offer.createdAt)}</span>
              </span>
              <span className="mw-acct-row-actions">
                <Link
                  to="/buy/vehicle/$id"
                  params={{ id: offer.listingId }}
                  className="mw-acct-row-link"
                >
                  View <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------ tab: listings */

function ListingsTab() {
  const [listings, setListings] = useState<OwnListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListings(ownListings());
  }, []);

  const toggleStatus = (listing: OwnListing) => {
    const next = listing.status === "Active" ? "Sold" : "Active";
    const result = setOwnListingStatus(listing.id, next);
    if (!result.ok) {
      setError(result.error ?? "The status could not be saved.");
      return;
    }
    setError(null);
    setListings(ownListings());
  };

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Listings</h2>
          <p className="mw-acct-panel-sub">Vehicles you submitted for sale from the Sell page.</p>
        </div>
        <Link to="/sell-your-car" className="mw-acct-inline-link">
          List another vehicle <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mw-acct-empty" data-testid="listings-empty">
          <Store size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No listings yet</p>
          <p className="mw-acct-empty-text">
            Submit a vehicle on the Sell page — it will show here with its live status.
          </p>
          <Link to="/sell-your-car" className="mw-acct-cta mw-acct-cta--inline">
            Sell a vehicle <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="listings-list">
          {listings.map((listing) => (
            <li key={listing.id} className="mw-acct-row" data-listing-id={listing.id}>
              <span className="mw-acct-thumb">
                {listing.photo ? (
                  <img src={listing.photo} alt="" aria-hidden="true" loading="lazy" />
                ) : (
                  <Store size={18} aria-hidden="true" />
                )}
              </span>
              <span className="mw-acct-row-main">
                <span className="mw-acct-row-title">
                  {listing.name || "Vehicle"}
                  <span
                    className={`mw-acct-status mw-acct-status--${listing.status === "Sold" ? "done" : "progress"}`}
                    data-testid="listing-status"
                  >
                    {listing.status}
                  </span>
                </span>
                <span className="mw-acct-row-meta">
                  {[listing.category, listing.year, listing.location].filter(Boolean).join(" · ")}
                </span>
                <span className="mw-acct-row-note">
                  {listing.expectedPrice ? `Expected ${listing.expectedPrice}` : "Price on request"}{" "}
                  · Submitted {formatWhen(listing.createdAt)}
                </span>
              </span>
              <span className="mw-acct-row-actions">
                <button
                  type="button"
                  className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                  data-testid="toggle-listing-status"
                  onClick={() => toggleStatus(listing)}
                >
                  {listing.status === "Active" ? "Mark as sold" : "Mark as active"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mw-acct-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/* --------------------------------------------------------------- tab: leads */

function LeadsTab() {
  const [leads, setLeads] = useState<TrackedLead[]>([]);
  useEffect(() => {
    setLeads(trackedLeads());
  }, []);

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Leads</h2>
          <p className="mw-acct-panel-sub">
            Finance, insurance, service and franchise applications — with their reference IDs.
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="mw-acct-empty" data-testid="leads-empty">
          <ClipboardList size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No applications yet</p>
          <p className="mw-acct-empty-text">
            Submit a finance, insurance, service or franchise request and its reference ID and
            status will be tracked here.
          </p>
          <Link to="/finance" className="mw-acct-cta mw-acct-cta--inline">
            Check finance eligibility <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="leads-list">
          {leads.map((lead) => (
            <li key={lead.id} className="mw-acct-row" data-lead-kind={lead.kind}>
              <span className="mw-acct-row-main">
                <span className="mw-acct-row-title">
                  {lead.label}
                  <span
                    className={`mw-acct-status mw-acct-status--${lead.tone}`}
                    data-testid="lead-status"
                  >
                    {lead.status}
                  </span>
                </span>
                <span className="mw-acct-row-meta">
                  {[lead.title, lead.detail].filter(Boolean).join(" · ")}
                </span>
                <span className="mw-acct-row-note">
                  {lead.reference ? (
                    <>
                      Reference <strong className="mw-acct-ref">{lead.reference}</strong>
                    </>
                  ) : (
                    "Reference ID shared by our team"
                  )}{" "}
                  · {formatWhen(lead.createdAt)}
                </span>
              </span>
              <span className="mw-acct-row-actions">
                <a href={lead.href} className="mw-acct-row-link">
                  Track <ChevronRight size={15} aria-hidden="true" />
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mw-acct-hint">
        Statuses come from the records stored on this device. Service bookings advance on their own
        mock timeline; our team confirms the rest when they contact you.
      </p>
    </>
  );
}
