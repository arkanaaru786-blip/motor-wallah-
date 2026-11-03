import { createFileRoute } from "@tanstack/react-router";
import { SiteSettingsPanel } from "@/components/admin/SiteSettings";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/settings")({
  head: () => ({
    meta: [
      { title: "Site Settings | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <SiteSettingsPanel session={session} />;
}
