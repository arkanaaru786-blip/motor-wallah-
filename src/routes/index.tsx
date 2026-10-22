import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Hero } from "@/components/site/Hero";
import { StickyActions } from "@/components/site/StickyActions";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BrowseCategories } from "@/components/site/BrowseCategories";
import {
  BusinessSpotlight,
  FranchiseBanner,
  MarketplaceActions,
  MarketplaceHub,
  PopularVehicles,
  TrustStrip,
} from "@/components/site/HomeMarketplaceSections";

const TITLE = "Motor Wallah | Every Vehicle. One Marketplace.";
const DESCRIPTION =
  "Discover, buy, sell, exchange, value and service cars, bikes, 3-wheelers, commercial vehicles and tractors with Motor Wallah.";

export const Route = createFileRoute("/")({
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
  component: Index,
});

function Index() {
  return (
    <div id="top" className="mw-home min-h-screen bg-background pb-16 md:pb-0">
      <SiteHeader homepage />
      <main>
        <Hero />
        <BrowseCategories />
        <FranchiseBanner />
        <MarketplaceHub />
        <PopularVehicles />
        <BusinessSpotlight />
        <MarketplaceActions />
        <TrustStrip />
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
