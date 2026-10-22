import { createFileRoute } from "@tanstack/react-router";
import { CategoryListingPage } from "@/components/site/CategoryListingPage";

const TITLE = "Buy Pre-Owned 3-Wheelers in Madhya Pradesh | Motor Wallah";
const DESCRIPTION = "Browse pre-owned passenger and cargo auto-rickshaws from Bajaj, Piaggio, Mahindra and more.";

export const Route = createFileRoute("/buy/three-wheelers")({
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
  component: () => <CategoryListingPage categoryId="three-wheelers" />,
});
