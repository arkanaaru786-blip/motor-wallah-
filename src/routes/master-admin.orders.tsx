import { createFileRoute } from "@tanstack/react-router";
import { AdminOrdersPanel } from "@/components/admin/AdminOrders";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrdersRoute,
});

function OrdersRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <AdminOrdersPanel session={session} />;
}
