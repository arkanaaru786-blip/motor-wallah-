import { createFileRoute } from "@tanstack/react-router";
import { AdLeadsPanel } from "@/components/admin/AdLeads";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/ad-leads")({
  head: () => ({
    meta: [
      { title: "Ad Leads | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdLeadsRoute,
});

function AdLeadsRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <AdLeadsPanel session={session} />;
}
