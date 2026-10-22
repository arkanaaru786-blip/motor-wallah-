import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/site/PagePlaceholder";

const TITLE = "Complete Car Care Workshop | Motor Wallah";
const DESCRIPTION = "Mechanical, electrical, denting, painting and detailing works under one roof.";

export const Route = createFileRoute("/workshop")({
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
  return <PagePlaceholder title="Complete Car Care Workshop" description="Mechanical, electrical, denting, painting and detailing works under one roof." />;
}
