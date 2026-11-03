import { createFileRoute } from "@tanstack/react-router";
import { AutomationLocked, AutomationRules } from "@/components/admin/AutomationRules";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, canViewAutomation } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/automation")({
  head: () => ({
    meta: [
      { title: "MW Autopilot | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AutomationRoute,
});

function AutomationRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!canViewAutomation(actorFromSession(session))) return <AutomationLocked />;
  return <AutomationRules session={session} />;
}
