import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Bikes in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned motorcycles and scooters from Hero, Honda, Bajaj, TVS, Royal Enfield and more.";

export const Route = createFileRoute("/buy/bikes")({
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
  component: () => <CategoryListingPage categoryId="bikes" />,
});
