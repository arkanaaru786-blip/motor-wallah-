import { createFileRoute } from "@tanstack/react-router";
import { BannersAdsPanel } from "@/components/admin/BannersAds";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/banners")({
  head: () => ({
    meta: [
      { title: "Banners & Ads | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BannersRoute,
});

function BannersRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <BannersAdsPanel session={session} />;
}
