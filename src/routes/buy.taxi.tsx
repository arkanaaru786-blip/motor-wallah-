import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Taxis in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned commercial-registered taxi cars for fleet and cab operators.";

export const Route = createFileRoute("/buy/taxi")({
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
  component: () => <CategoryListingPage categoryId="taxi" />,
});
