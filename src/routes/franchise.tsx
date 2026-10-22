import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Franchise Partnership | Motor Wallah";
const DESCRIPTION = "Join the Motor Wallah certified pre-owned car network with structured processes and support.";

export const Route = createFileRoute("/franchise")({
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
  return <PagePlaceholder title="Franchise Partnership" description="Join the Motor Wallah certified pre-owned car network with structured processes and support." />;
}
