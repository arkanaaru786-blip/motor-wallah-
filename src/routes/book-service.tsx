import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Book a Service | Motor Wallah";
const DESCRIPTION = "Book a car service slot with the Motor Wallah workshop in Indore.";

export const Route = createFileRoute("/book-service")({
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
  return <PagePlaceholder title="Book a Service" description="Book a car service slot with the Motor Wallah workshop in Indore." />;
}
