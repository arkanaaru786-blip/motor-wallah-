import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Small Commercial Vehicles in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned mini trucks and pickups like Tata Ace, Mahindra Bolero Pickup and Ashok Leyland Dost.";

export const Route = createFileRoute("/buy/scv")({
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
  component: () => <CategoryListingPage categoryId="scv" />,
});
