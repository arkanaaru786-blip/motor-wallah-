import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Roadside Assistance | Motor Wallah";
const DESCRIPTION = "Roadside assistance available through service partners.";

export const Route = createFileRoute("/roadside-assistance")({
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
  component: Page,
});

function Page() {
  return <PagePlaceholder title="Roadside Assistance" description="Roadside assistance available through service partners." />;
}
