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
  Pencil,
  Store,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { useCustomerSession, maskMobile, signOut, updateProfile } from "@/lib/account-store";
import type { CustomerProfile } from "@/lib/account-store";
import { ChatThreadView, BUYER_QUICK_REPLIES } from "@/components/chat/ChatThreadView";
import { subscribeToChat } from "@/lib/listing-chat";
import {
  chatThreads,
  dashboardCounts,
  deleteOwnListing,
  ownListings,
  setOwnListingStatus,
  trackedLeads,
  updateOwnListing,
  type ChatThread,
  type OwnListing,
  type TrackedLead,
} from "@/lib/account-data";
import { listOffers, type ListingOffer, type OfferStatus } from "@/lib/listing-offers";
import { useShortlist } from "@/lib/shortlist";
import { buyListingName, getBuyListing, lakhLabel, rupees } from "@/lib/buy-catalog";

const TITLE = "My Dashboard — Ads, Favorites & Requests | Motor Wallah";
const DESCRIPTION =
  "Your Motor Wallah dashboard: edit your profile, see favourites, seller chats, your ads for sale and every finance, insurance, service or franchise request with its reference ID.";

const TABS = [
  { id: "profile", label: "My Profile", blurb: "Name, email, city, mobile", icon: UserRound },
  { id: "favorites", label: "My Favorites", blurb: "Vehicles you hearted", icon: Heart },
  { id: "chats", label: "My Chats", blurb: "Seller conversations", icon: MessageSquare },
  { id: "ads", label: "My Ads", blurb: "Vehicles you listed", icon: Store },
  { id: "requests", label: "My Requests", blurb: "Forms & reference IDs", icon: ClipboardList },
] as const;

type AccountTab = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((tab) => tab.id) as string[];

/** Old tab ids keep working so existing links do not break. */
const LEGACY_TABS: Record<string, AccountTab> = {
  saved: "favorites",
  listings: "ads",
  leads: "requests",
  offers: "requests",
};

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
    const mapped = typeof raw === "string" ? (LEGACY_TABS[raw] ?? raw) : undefined;
    const tab =
      typeof mapped === "string" && TAB_IDS.includes(mapped) ? (mapped as AccountTab) : undefined;
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

const priceLabel = (value: string) =>
  /^\d+$/.test(value) ? `₹${Number(value).toLocaleString("en-IN")}` : `₹${value}`;

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
  const [counts, setCounts] = useState({
    saved: 0,
    chats: 0,
    offers: 0,
    listings: 0,
    leads: 0,
  });

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
  const countFor = (id: AccountTab) => {
    if (id === "favorites") return counts.saved;
    if (id === "ads") return counts.listings;
    if (id === "requests") return counts.leads;
    if (id === "chats") return counts.chats;
    return null;
  };

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
                {maskMobile(customer.mobile)} · {customer.city}
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
                const count = countFor(item.id);
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
              {tab === "favorites" && <FavoritesTab />}
              {tab === "chats" && <ChatsTab selectedId={chat} />}
              {tab === "ads" && <AdsTab />}
              {tab === "requests" && <RequestsTab />}
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
            Your name, email, city and mobile number — used on everything you send us.
          </p>
        </div>
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

/* ----------------------------------------------------------- tab: favorites */

function FavoritesTab() {
  const { ids, ready, toggle } = useShortlist();

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Favorites</h2>
          <p className="mw-acct-panel-sub">Every vehicle you hearted on the Buy page.</p>
        </div>
        <Link to="/buy" className="mw-acct-inline-link">
          Browse vehicles <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {!ready ? (
        <p className="mw-acct-note">Loading your favorites…</p>
      ) : ids.length === 0 ? (
        <div className="mw-acct-empty" data-testid="favorites-empty">
          <Heart size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No favorites yet</p>
          <p className="mw-acct-empty-text">
            Tap the heart on any listing and it appears here — ready to compare or make an offer.
          </p>
          <Link to="/buy" className="mw-acct-cta mw-acct-cta--inline">
            Explore the marketplace <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="favorites-list">
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
                        ? `Remove ${buyListingName(listing)} from favorites`
                        : "Remove favourite"
                    }
                    data-testid="favorites-remove"
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => {
      setThreads(chatThreads());
      setLoaded(true);
    };
    sync();
    return subscribeToChat(sync);
  }, []);

  const activeId = selectedId ?? threads[0]?.listingId ?? null;
  const active = threads.find((thread) => thread.listingId === activeId) ?? null;
  const listing = active ? getBuyListing(active.listingId) : undefined;

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Chats</h2>
          <p className="mw-acct-panel-sub">
            Conversations you started with sellers from a listing.
          </p>
        </div>
        <Link
          to="/seller"
          className="mw-acct-cta mw-acct-cta--inline"
          data-testid="chats-seller-desk"
        >
          Seller desk <ArrowRight size={16} aria-hidden="true" />
        </Link>
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
                        {thread.lastMessage.role === "seller" ? "Seller: " : ""}
                        {thread.lastMessage.body}
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
                <span className="mw-acct-chat-status">
                  {listing ? `${listing.model} Seller · replies in a few seconds` : "Seller"}
                </span>
              </span>
            </div>

            {listing ? (
              <ChatThreadView listing={listing} role="buyer" quickReplies={BUYER_QUICK_REPLIES} />
            ) : (
              <p className="mw-acct-chat-hint">Select a conversation to continue.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- tab: ads */

const EMPTY_EDIT = { name: "", price: "", city: "", category: "" };

function AdsTab() {
  const [ads, setAds] = useState<OwnListing[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_EDIT);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => setAds(ownListings());

  useEffect(() => {
    refresh();
  }, []);

  const startEdit = (ad: OwnListing) => {
    setEditingId(ad.id);
    setDraft({
      name: ad.name,
      price: ad.expectedPrice,
      city: ad.location,
      category: ad.category,
    });
    setConfirmId(null);
    setError(null);
    setNotice(null);
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    const result = updateOwnListing(editingId, draft);
    if (!result.ok) {
      setError(result.error ?? "Your changes could not be saved.");
      return;
    }
    setEditingId(null);
    setError(null);
    setNotice("Ad updated.");
    refresh();
  };

  const remove = (id: string) => {
    const result = deleteOwnListing(id);
    if (!result.ok) {
      setError(result.error ?? "This ad could not be deleted.");
      return;
    }
    setConfirmId(null);
    setError(null);
    setNotice("Ad deleted.");
    refresh();
  };

  const toggleStatus = (ad: OwnListing) => {
    const next = ad.status === "Active" ? "Sold" : "Active";
    const result = setOwnListingStatus(ad.id, next);
    if (!result.ok) {
      setError(result.error ?? "The status could not be saved.");
      return;
    }
    setError(null);
    refresh();
  };

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Ads</h2>
          <p className="mw-acct-panel-sub">Vehicles you listed for sale from the Sell page.</p>
        </div>
        <Link to="/sell-your-car" className="mw-acct-inline-link">
          Post an ad <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {ads.length === 0 ? (
        <div className="mw-acct-empty" data-testid="ads-empty">
          <Store size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No ads yet</p>
          <p className="mw-acct-empty-text">
            Post a vehicle on the Sell page — it shows here with its price and status.
          </p>
          <Link to="/sell-your-car" className="mw-acct-cta mw-acct-cta--inline">
            Sell a vehicle <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mw-acct-rows" data-testid="ads-list">
          {ads.map((ad) => {
            const editing = editingId === ad.id;
            const confirming = confirmId === ad.id;
            return (
              <li key={ad.id} className="mw-acct-row" data-ad-id={ad.id}>
                <span className="mw-acct-thumb">
                  {ad.photo ? (
                    <img src={ad.photo} alt="" aria-hidden="true" loading="lazy" />
                  ) : (
                    <Store size={18} aria-hidden="true" />
                  )}
                </span>

                {editing ? (
                  <form className="mw-acct-edit" onSubmit={saveEdit} data-testid="ad-edit-form">
                    <div className="mw-acct-field">
                      <label className="mw-acct-label" htmlFor={`ad-title-${ad.id}`}>
                        Title
                      </label>
                      <input
                        id={`ad-title-${ad.id}`}
                        className="mw-acct-input"
                        data-testid="ad-edit-name"
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </div>
                    <div className="mw-acct-field">
                      <label className="mw-acct-label" htmlFor={`ad-price-${ad.id}`}>
                        Price
                      </label>
                      <input
                        id={`ad-price-${ad.id}`}
                        className="mw-acct-input"
                        data-testid="ad-edit-price"
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                      />
                    </div>
                    <div className="mw-acct-field">
                      <label className="mw-acct-label" htmlFor={`ad-city-${ad.id}`}>
                        City
                      </label>
                      <input
                        id={`ad-city-${ad.id}`}
                        className="mw-acct-input"
                        data-testid="ad-edit-city"
                        value={draft.city}
                        onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                      />
                    </div>
                    <div className="mw-acct-field">
                      <label className="mw-acct-label" htmlFor={`ad-category-${ad.id}`}>
                        Category
                      </label>
                      <input
                        id={`ad-category-${ad.id}`}
                        className="mw-acct-input"
                        data-testid="ad-edit-category"
                        value={draft.category}
                        onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                      />
                    </div>
                    <div className="mw-acct-edit-actions">
                      <button
                        type="submit"
                        className="mw-acct-cta mw-acct-cta--inline"
                        data-testid="ad-edit-save"
                      >
                        Save ad
                      </button>
                      <button
                        type="button"
                        className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                        data-testid="ad-edit-cancel"
                        onClick={() => {
                          setEditingId(null);
                          setError(null);
                        }}
                      >
                        <X size={14} aria-hidden="true" /> Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span className="mw-acct-row-main">
                      <span className="mw-acct-row-title">
                        {ad.name || "Vehicle"}
                        <span
                          className={`mw-acct-status mw-acct-status--${ad.status === "Sold" ? "done" : "progress"}`}
                          data-testid="ad-status"
                        >
                          {ad.status}
                        </span>
                      </span>
                      <span className="mw-acct-row-meta">
                        {[ad.category, ad.year, ad.location].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mw-acct-row-note">
                        {ad.expectedPrice ? priceLabel(ad.expectedPrice) : "Price on request"} ·
                        Posted {formatWhen(ad.createdAt)}
                      </span>
                    </span>
                    <span className="mw-acct-row-actions">
                      <button
                        type="button"
                        className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                        data-testid="ad-edit"
                        onClick={() => startEdit(ad)}
                      >
                        <Pencil size={13} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                        data-testid="ad-toggle-status"
                        onClick={() => toggleStatus(ad)}
                      >
                        {ad.status === "Active" ? "Mark sold" : "Mark active"}
                      </button>
                      {confirming ? (
                        <span className="mw-acct-confirm">
                          <button
                            type="button"
                            className="mw-acct-ghostbtn mw-acct-ghostbtn--sm mw-acct-ghostbtn--danger"
                            data-testid="ad-delete-confirm"
                            onClick={() => remove(ad.id)}
                          >
                            <Trash2 size={13} aria-hidden="true" /> Delete
                          </button>
                          <button
                            type="button"
                            className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                            data-testid="ad-delete-cancel"
                            onClick={() => setConfirmId(null)}
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="mw-acct-ghostbtn mw-acct-ghostbtn--sm"
                          data-testid="ad-delete"
                          onClick={() => {
                            setConfirmId(ad.id);
                            setError(null);
                            setNotice(null);
                          }}
                        >
                          <Trash2 size={13} aria-hidden="true" /> Delete
                        </button>
                      )}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mw-acct-error" role="alert" data-testid="ads-error">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mw-acct-success" role="status" data-testid="ads-notice">
          {notice}
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------ tab: requests */

function RequestsTab() {
  const [leads, setLeads] = useState<TrackedLead[]>([]);
  const [offers, setOffers] = useState<ListingOffer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLeads(trackedLeads());
    setOffers(listOffers());
    setLoaded(true);
  }, []);

  return (
    <>
      <div className="mw-acct-panel-head">
        <div>
          <h2 className="mw-acct-panel-title">My Requests</h2>
          <p className="mw-acct-panel-sub">
            Everything you have sent us — finance, insurance, service, franchise and offers — with
            its reference ID and status.
          </p>
        </div>
      </div>

      {!loaded ? (
        <p className="mw-acct-note">Loading your requests…</p>
      ) : leads.length === 0 && offers.length === 0 ? (
        <div className="mw-acct-empty" data-testid="requests-empty">
          <ClipboardList size={26} aria-hidden="true" />
          <p className="mw-acct-empty-title">No requests yet</p>
          <p className="mw-acct-empty-text">
            Submit a finance, insurance, service or franchise form — its reference ID and status are
            tracked here.
          </p>
          <Link to="/finance" className="mw-acct-cta mw-acct-cta--inline">
            Check finance eligibility <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          {leads.length > 0 && (
            <ul className="mw-acct-rows" data-testid="requests-list">
              {leads.map((lead) => (
                <li key={lead.id} className="mw-acct-row" data-lead-kind={lead.kind}>
                  <span className="mw-acct-row-main">
                    <span className="mw-acct-row-title">
                      {lead.label}
                      <span
                        className={`mw-acct-status mw-acct-status--${lead.status === "Approved" ? "done" : "pending"}`}
                        data-testid="lead-status"
                        data-status={lead.status}
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

          {offers.length > 0 && (
            <div className="mw-acct-section">
              <h3 className="mw-acct-section-title">
                <BadgeIndianRupee size={16} aria-hidden="true" /> Offers you made
              </h3>
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
                      <span className="mw-acct-row-note">
                        Offered on {formatWhen(offer.createdAt)}
                      </span>
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
            </div>
          )}
        </>
      )}

      <p className="mw-acct-hint">
        Statuses come from the records stored on this device. Service bookings move to Approved once
        the mock timeline completes; our team confirms the rest when they contact you.
      </p>
    </>
  );
}
