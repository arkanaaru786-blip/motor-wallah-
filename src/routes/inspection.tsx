import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Vehicle Inspection & Certification | Motor Wallah";
const DESCRIPTION = "Every Motor Wallah car goes through a 150+ point vehicle inspection before certification.";

export const Route = createFileRoute("/inspection")({
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
  return <PagePlaceholder title="Vehicle Inspection & Certification" description="Every Motor Wallah car goes through a 150+ point vehicle inspection before certification." />;
}
