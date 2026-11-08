import { createFileRoute } from "@tanstack/react-router";

import { AccessDenied } from "@/components/admin/AccessDenied";
import { PartnerDirectory } from "@/components/admin/PartnerDirectory";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/partners")({
  head: () => ({
    meta: [
      { title: "Partners | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PartnersRoute,
});

function PartnersRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "employee.view")) {
    return (
      <AccessDenied
        title="Partner accounts are restricted"
        description={`Your role (${session.role}) cannot open partner accounts. Ask a super admin if you need it.`}
      />
    );
  }
  return <PartnerDirectory session={session} />;
}
