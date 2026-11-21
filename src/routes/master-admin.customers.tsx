import { createFileRoute } from "@tanstack/react-router";
import { CustomerDirectory } from "@/components/admin/CustomerDirectory";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomersRoute,
});

function CustomersRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <CustomerDirectory session={session} />;
}
