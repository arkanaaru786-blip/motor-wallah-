import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/")({
  component: MasterAdminOverview,
});

function MasterAdminOverview() {
  const { session } = useAdminSession();
  return <AdminDashboard actor={session?.name ?? "Administrator"} />;
}
