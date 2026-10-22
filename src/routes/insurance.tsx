import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Insurance Assistance | Motor Wallah";
const DESCRIPTION = "Insurance assistance through relevant providers for your pre-owned car.";

export const Route = createFileRoute("/insurance")({
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
  return <PagePlaceholder title="Insurance Assistance" description="Insurance assistance through relevant providers for your pre-owned car." />;
}
