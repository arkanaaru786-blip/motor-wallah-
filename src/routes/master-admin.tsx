import { useEffect, useMemo } from "react";
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentAdmin, useAdminSession } from "@/lib/admin-auth";
import { ensureAdminDatabase, isOpenStatus } from "@/lib/admin-crm";

/**
 * Master control room layout.
 *
 * Access control lives here, so it applies to every child route: a synchronous
 * session read in `beforeLoad` (the panel's equivalent of middleware) plus the
 * reactive session in the layout component, which handles the hydration pass
 * where `beforeLoad` ran without a browser.
 */
export const Route = createFileRoute("/master-admin")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentAdmin()) throw redirect({ to: "/master-admin/login" });
  },
  head: () => ({
    meta: [
      { title: "Master Control Room | Motor Wallah" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MasterAdminLayout,
});

function MasterAdminLayout() {
  const { ready, session } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (ready && !session) {
      void navigate({ to: "/master-admin/login", replace: true });
    }
  }, [ready, session, navigate]);

  const openCount = useMemo(() => {
    if (pathname === "/master-admin/login") return 0;
    return ensureAdminDatabase().cases.filter((item) => isOpenStatus(item.status)).length;
  }, [pathname]);

  if (!ready || !session) {
    return (
      <div className="mw-admin mw-admin-loading" aria-busy="true">
        <span className="mw-admin-loading-dot" />
        Opening the control room…
      </div>
    );
  }

  const isTracker = pathname.startsWith("/master-admin/tracker");

  return (
    <AdminShell
      session={session}
      title={isTracker ? "Master Tracker" : "Master Dashboard"}
      subtitle={
        isTracker
          ? "Every business case from every flow — one table, one owner, one status."
          : "Live snapshot of revenue, demand and what needs a decision today."
      }
      openCount={openCount}
    >
      <Outlet />
    </AdminShell>
  );
}
