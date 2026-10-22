import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Car Accessories | Motor Wallah";
const DESCRIPTION = "Car accessories and fitment support at Motor Wallah.";

export const Route = createFileRoute("/accessories")({
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
  return <PagePlaceholder title="Car Accessories" description="Car accessories and fitment support at Motor Wallah." />;
}
