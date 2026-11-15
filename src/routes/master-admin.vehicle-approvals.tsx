import { createFileRoute } from "@tanstack/react-router";
import { VehicleApprovalsPanel } from "@/components/admin/VehicleApprovals";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/vehicle-approvals")({
  head: () => ({
    meta: [
      { title: "Vehicle Approvals | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VehicleApprovalsRoute,
});

function VehicleApprovalsRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <VehicleApprovalsPanel session={session} />;
}
