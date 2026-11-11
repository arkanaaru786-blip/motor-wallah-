import { createFileRoute } from "@tanstack/react-router";
import PageLoader from "@/components/loader/PageLoader";

export const Route = createFileRoute("/demo-loader")({
  head: () => ({
    meta: [
      { title: "Loader Demo | Motor Wallah" },
      {
        name: "description",
        content: "Preview of the Motor Wallah page-transition loading screen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PageLoader,
});
