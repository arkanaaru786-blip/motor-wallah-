import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { ArrowRight, MessageSquare, ShieldCheck } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { useDealerSession } from "@/lib/dealer-session";

const TITLE = "Seller Desk — Buyer Chats | Motor Wallah";
const DESCRIPTION =
  "Buyer conversations now live in the dealer portal: every enquiry for your listings, with live replies and unread counts.";

/**
 * The old Seller Desk read the conversations stored in this browser.
 *
 * Chats are now stored in Supabase and belong to a dealer account, so the inbox
 * moved to the dealer portal (My Chats). This page keeps the old link working:
 * a signed-in dealer goes straight to that tab, everyone else is pointed at the
 * dealer sign-in.
 */
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
  component: SellerDeskRedirect,
});

function SellerDeskRedirect() {
  const { ready, session } = useDealerSession();

  if (ready && session) return <Navigate to="/dealer" search={{ tab: "chats" }} replace />;

  return (
    <div className="mw-sell mw-seller">
      <SiteHeader pills />
      <main className="mw-acct-main" data-testid="seller-desk">
        <div className="home-container">
          <div className="mw-seller-login" data-testid="seller-signin-prompt">
            <span className="mw-seller-login-icon" aria-hidden="true">
              <MessageSquare size={22} />
            </span>
            <h1>Buyer chats live in the dealer portal</h1>
            <p>
              Every enquiry for your inventory is stored against your dealer account, so the
              conversation follows you to any device. Sign in to answer buyers.
            </p>
            <div className="mw-seller-login-actions">
              <Link to="/dealer-login" className="mw-btn mw-btn--primary">
                Dealer sign in <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/account" search={{ tab: "chats" }} className="mw-btn mw-btn--outline">
                My buyer chats
              </Link>
            </div>
            <p className="mw-seller-login-note">
              <ShieldCheck size={13} aria-hidden="true" /> Messages are visible only to you and the
              buyer who wrote them.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
