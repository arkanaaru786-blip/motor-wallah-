import { createFileRoute } from "@tanstack/react-router";

import { AccessDenied } from "@/components/admin/AccessDenied";
import { WorkshopDisputes } from "@/components/admin/WorkshopDisputes";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/disputes")({
  head: () => ({
    meta: [
      { title: "Workshop Disputes | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DisputesRoute,
});

function DisputesRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "audit.view")) {
    return (
      <AccessDenied
        title="Payment disputes are restricted"
        description={`Your role (${session.role}) cannot open the dispute queue. Ask a super admin or manager if you need access.`}
      />
    );
  }
  return <WorkshopDisputes session={session} />;
}
