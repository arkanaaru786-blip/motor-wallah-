import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Contact Motor Wallah | Motor Wallah";
const DESCRIPTION = "Talk to the Motor Wallah team in Indore for buying, selling, service or franchise queries.";

export const Route = createFileRoute("/contact")({
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
  return <PagePlaceholder title="Contact Motor Wallah" description="Talk to the Motor Wallah team in Indore for buying, selling, service or franchise queries." />;
}
