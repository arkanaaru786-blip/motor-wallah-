import { createFileRoute } from "@tanstack/react-router";
import { MasterAdminLoginPage } from "@/components/admin/AdminLogin";

export const Route = createFileRoute("/master-admin_/login")({
  head: () => ({
    meta: [
      { title: "Master Admin Sign In | Motor Wallah" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MasterAdminLoginPage,
});
