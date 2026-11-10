import { createFileRoute } from "@tanstack/react-router";
import { AdvancedAnalytics } from "@/components/admin/AdvancedAnalytics";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/analytics")({
  head: () => ({
    meta: [
      { title: "Advanced Analytics | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "reports.view")) {
    return (
      <AccessDenied
        title="Reports & Analytics is restricted"
        description="Managers and super admins can view the advanced analytics dashboard."
      />
    );
  }
  return <AdvancedAnalytics session={session} />;
}
