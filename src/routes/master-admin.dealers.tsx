import { createFileRoute } from "@tanstack/react-router";

import { AccessDenied } from "@/components/admin/AccessDenied";
import { DealerDirectory } from "@/components/admin/DealerDirectory";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/dealers")({
  head: () => ({
    meta: [
      { title: "Dealers | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DealersRoute,
});

function DealersRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "employee.view")) {
    return (
      <AccessDenied
        title="Dealer accounts are restricted"
        description={`Your role (${session.role}) cannot open dealer accounts. Ask a super admin if you need it.`}
      />
    );
  }
  return <DealerDirectory session={session} />;
}
