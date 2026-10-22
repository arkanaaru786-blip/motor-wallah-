import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Trucks in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned light, medium and heavy trucks from Tata, Ashok Leyland, Eicher and BharatBenz.";

export const Route = createFileRoute("/buy/trucks")({
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
  component: () => <CategoryListingPage categoryId="trucks" />,
});
