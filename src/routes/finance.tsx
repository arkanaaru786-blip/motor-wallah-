import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Car Finance | Motor Wallah";
const DESCRIPTION = "Finance assistance through relevant lending partners for your certified pre-owned car.";

export const Route = createFileRoute("/finance")({
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
  return <PagePlaceholder title="Car Finance" description="Finance assistance through relevant lending partners for your certified pre-owned car." />;
}
