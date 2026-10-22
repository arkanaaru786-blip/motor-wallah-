import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Apply for a Franchise | Motor Wallah";
const DESCRIPTION = "Share your details to start the Motor Wallah franchise partnership conversation.";

export const Route = createFileRoute("/franchise/apply")({
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
  return <PagePlaceholder title="Apply for a Franchise" description="Share your details to start the Motor Wallah franchise partnership conversation." />;
}
