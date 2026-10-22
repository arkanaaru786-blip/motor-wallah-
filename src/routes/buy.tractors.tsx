import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Tractors in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned tractors from Mahindra, Swaraj, Sonalika, John Deere and more.";

export const Route = createFileRoute("/buy/tractors")({
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
  component: () => <CategoryListingPage categoryId="tractors" />,
});
