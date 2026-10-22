import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { BuyVehicleDetail } from "@/components/buy/BuyVehicleDetail";
import { buyListingName, getBuyListing, lakhLabel } from "@/lib/buy-catalog";

export const Route = createFileRoute("/buy/vehicle/$id")({
  loader: ({ params }) => {
    const listing = getBuyListing(params.id);
    if (!listing) throw notFound();
    return { listing };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Listing unavailable | Motor Wallah" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { listing } = loaderData;
    const title = `${buyListingName(listing)} — ${lakhLabel(listing.priceLakh)} | Motor Wallah`;
    const description = `${buyListingName(listing)} in ${listing.city}: ${listing.fuel}, ${listing.year}${listing.kilometres !== null ? `, ${listing.kilometres.toLocaleString("en-IN")} km` : ""}. Demo catalogue listing — not confirmed inventory.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: ListingNotFound,
  component: Page,
});

function ListingNotFound() {
  return (
    <div className="mw-buy min-h-screen">
      <SiteHeader />
      <div className="home-container buy-not-found">
        <p className="buy-empty-title">Listing not found</p>
        <p className="buy-empty-text">
          This vehicle listing does not exist or is no longer part of the catalogue.
        </p>
        <Link to="/buy" className="buy-primary-button">
          Back to Buy
        </Link>
      </div>
      <SiteFooter />
    </div>
  );
}

function Page() {
  const { listing } = Route.useLoaderData();

  return (
    <div className="mw-buy min-h-screen pb-16 md:pb-0">
      <SiteHeader />
      <main>
        <BuyVehicleDetail listing={listing} />
      </main>
      <SiteFooter />
      <StickyActions />
    </div>
  );
}
