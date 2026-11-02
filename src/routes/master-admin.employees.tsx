import { createFileRoute } from "@tanstack/react-router";
import { EmployeeDirectory } from "@/components/admin/EmployeeDirectory";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { useAdminSession } from "@/lib/admin-auth";
import { actorFromSession, can } from "@/lib/admin-rbac";

export const Route = createFileRoute("/master-admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EmployeesRoute,
});

function EmployeesRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  if (!can(actorFromSession(session), "employee.view")) {
    return (
      <AccessDenied
        title="Employee directory is restricted"
        description={`Your role (${session.role}) cannot open the directory. Ask a super admin if you need it.`}
      />
    );
  }
  return <EmployeeDirectory session={session} />;
}
