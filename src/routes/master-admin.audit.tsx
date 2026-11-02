import { createFileRoute } from "@tanstack/react-router";
import { AuditLog } from "@/components/admin/AuditLog";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuditRoute,
});

function AuditRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "audit.view")) {
    return (
      <AccessDenied
        title="Audit log is restricted"
        description="Managers and super admins can read the audit log."
      />
    );
  }
  return <AuditLog session={session} />;
}
