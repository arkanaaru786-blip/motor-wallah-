import { useEffect, useMemo, useState } from "react";
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentAdmin, useAdminSession } from "@/lib/admin-auth";
import {
  ensureAdminDatabase,
  isOpenStatus,
  openCasesFor,
  subscribeToAdminData,
  visibleCases,
  visibleEmployees,
} from "@/lib/admin-crm";
import { actorFromSession } from "@/lib/admin-rbac";
import { ensureAutopilot, listRules, visibleRules } from "@/lib/admin-automation";

/**
 * Master control room layout.
 *
 * Access control lives here, so it applies to every child route: a synchronous
 * session read in `beforeLoad` (the panel's equivalent of middleware) plus the
 * reactive session in the layout component, which handles the hydration pass
 * where `beforeLoad` ran without a browser.
 *
 * This is the door, not the policy: role and department checks are repeated in
 * `src/lib/admin-crm.ts` inside every mutation that touches a case or an
 * employee, so a route guard is never the only thing standing in the way.
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

const HEADINGS: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: "Master Dashboard",
    subtitle: "Live snapshot of revenue, demand and what needs a decision today.",
  },
  tracker: {
    title: "Master Tracker",
    subtitle: "Every business case you can access — one table, one owner, one status.",
  },
  employees: {
    title: "Employee Directory",
    subtitle: "Who works here, which desk they own and what they are allowed to do.",
  },
  dealers: {
    title: "Dealer Accounts",
    subtitle: "Every dealer and the single vehicle category their portal is bound to.",
  },
  audit: {
    title: "Audit Log",
    subtitle: "Every sensitive action, attributed to a person and a role.",
  },
  automation: {
    title: "MW Autopilot",
    subtitle: "Rules that run themselves — and a check that no submission goes missing.",
  },
  settings: {
    title: "Site Settings",
    subtitle: "The support number and inbox shown across the public site.",
  },
};

function headingFor(pathname: string) {
  if (pathname.startsWith("/master-admin/tracker")) return HEADINGS["tracker"]!;
  if (pathname.startsWith("/master-admin/employees")) return HEADINGS["employees"]!;
  if (pathname.startsWith("/master-admin/dealers")) return HEADINGS["dealers"]!;
  if (pathname.startsWith("/master-admin/audit")) return HEADINGS["audit"]!;
  if (pathname.startsWith("/master-admin/automation")) return HEADINGS["automation"]!;
  if (pathname.startsWith("/master-admin/settings")) return HEADINGS["settings"]!;
  return HEADINGS["overview"]!;
}

function MasterAdminLayout() {
  const { ready, session } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (ready && !session) {
      void navigate({ to: "/master-admin/login", replace: true });
    }
  }, [ready, session, navigate]);

  useEffect(() => subscribeToAdminData(() => setVersion((value) => value + 1)), []);

  const counts = useMemo(() => {
    void version;
    if (!session) return { open: 0, mine: 0, employees: 0, rules: 0 };
    const data = ensureAdminDatabase();
    ensureAutopilot();
    const actor = actorFromSession(session);
    const cases = visibleCases(actor, data.cases);
    return {
      open: cases.filter((item) => isOpenStatus(item.status)).length,
      mine: openCasesFor(cases, actor.id).length,
      employees: visibleEmployees(actor, data.employees).length,
      rules: visibleRules(actor, listRules()).filter((rule) => rule.enabled).length,
    };
  }, [session, version]);

  if (!ready || !session) {
    return (
      <div className="mw-admin mw-admin-loading" aria-busy="true">
        <span className="mw-admin-loading-dot" />
        Opening the control room…
      </div>
    );
  }

  const heading = headingFor(pathname);

  return (
    <AdminShell
      session={session}
      title={heading.title}
      subtitle={heading.subtitle}
      openCount={counts.open}
      myCount={counts.mine}
      employeeCount={counts.employees}
      ruleCount={counts.rules}
    >
      <Outlet />
    </AdminShell>
  );
}
