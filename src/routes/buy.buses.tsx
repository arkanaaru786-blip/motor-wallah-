import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned Buses in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned school, staff and tourist buses from Tata, Ashok Leyland, Eicher and Force.";

export const Route = createFileRoute("/buy/buses")({
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
  component: () => <CategoryListingPage categoryId="buses" />,
});
