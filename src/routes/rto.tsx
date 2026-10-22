import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "RTO Documentation | Motor Wallah";
const DESCRIPTION = "RTO and ownership-transfer assistance for buyers and sellers.";

export const Route = createFileRoute("/rto")({
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
  return <PagePlaceholder title="RTO Documentation" description="RTO and ownership-transfer assistance for buyers and sellers." />;
}
