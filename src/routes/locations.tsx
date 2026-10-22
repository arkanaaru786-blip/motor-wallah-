import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Locations | Motor Wallah";
const DESCRIPTION = "Find Motor Wallah near you — currently serving Indore, Madhya Pradesh.";

export const Route = createFileRoute("/locations")({
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
  return <PagePlaceholder title="Locations" description="Find Motor Wallah near you — currently serving Indore, Madhya Pradesh." />;
}
