import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  ScrollText,
  Settings,
  Store,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  ADMIN_SOURCE_LABEL,
  sessionRoleLabel,
  signOutAdmin,
  type AdminSession,
} from "@/lib/admin-auth";
import { actorFromSession, can, canViewAutomation, isSuperAdmin } from "@/lib/admin-rbac";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  count?: number;
  search?: { scope: "my" | "all" };
};

const LOCKED: { label: string; icon: typeof LayoutDashboard; phase: string }[] = [
  { label: "Inventory & Listings", icon: Boxes, phase: "Phase 4" },
  { label: "Finance Desk", icon: Wallet, phase: "Phase 4" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const navTestId = (label: string) => `admin-nav-${label.toLowerCase().replace(/\s+/g, "-")}`;

export function AdminShell({
  session,
  title,
  subtitle,
  actions,
  children,
  openCount,
  myCount,
  employeeCount,
  ruleCount,
  disputeCount,
}: {
  session: AdminSession;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
  openCount?: number;
  myCount?: number;
  employeeCount?: number;
  ruleCount?: number;
  disputeCount?: number;
}) {
  const actor = actorFromSession(session);
  const nav: NavItem[] = [
    { to: "/master-admin", label: "Overview", icon: LayoutDashboard, exact: true },
    {
      to: "/master-admin/tracker",
      label: "Master Tracker",
      icon: ClipboardList,
      ...(typeof openCount === "number" ? { count: openCount } : {}),
    },
    {
      to: "/master-admin/tracker",
      label: "My Tasks",
      icon: ListChecks,
      search: { scope: "my" },
      ...(typeof myCount === "number" ? { count: myCount } : {}),
    },
  ];

  if (can(actor, "employee.view")) {
    nav.push({
      to: "/master-admin/employees",
      label: "Employees",
      icon: Users,
      ...(typeof employeeCount === "number" ? { count: employeeCount } : {}),
    });
  }
  if (can(actor, "employee.view")) {
    nav.push({ to: "/master-admin/dealers", label: "Dealers", icon: Store });
  }
  if (can(actor, "employee.view")) {
    nav.push({ to: "/master-admin/partners", label: "Partners", icon: Building2 });
  }
  if (can(actor, "audit.view")) {
    nav.push({
      to: "/master-admin/disputes",
      label: "Disputes",
      icon: ShieldAlert,
      ...(typeof disputeCount === "number" ? { count: disputeCount } : {}),
    });
    nav.push({ to: "/master-admin/audit", label: "Audit Log", icon: ScrollText });
  }
  if (canViewAutomation(actor)) {
    nav.push({
      to: "/master-admin/automation",
      label: "Autopilot",
      icon: Zap,
      ...(typeof ruleCount === "number" ? { count: ruleCount } : {}),
    });
  }
  if (can(actor, "reports.view")) {
    nav.push({ to: "/master-admin/analytics", label: "Reports & Analytics", icon: BarChart3 });
  }
  if (isSuperAdmin(actor)) {
    nav.push({ to: "/master-admin/settings", label: "Site Settings", icon: Settings });
  }

  return (
    <div className="mw-admin mw-admin-shell">
      <aside className="mw-admin-side">
        <Link to="/master-admin" className="mw-admin-brand" aria-label="Master control room home">
          <span className="mw-admin-brandmark">MW</span>
          <span className="mw-admin-brandtext">
            <strong>Motor Wallah</strong>
            <small>Master Control</small>
          </span>
        </Link>

        <p className="mw-admin-navlabel">Control room</p>
        <nav className="mw-admin-nav" aria-label="Control room sections">
          {nav.map((item) => (
            <Link
              key={`${item.to}-${item.label}`}
              to={item.to}
              {...(item.search ? { search: item.search } : {})}
              activeOptions={{ exact: item.exact ?? false }}
              className="mw-admin-navlink"
              activeProps={{ className: "mw-admin-navlink is-active", "aria-current": "page" }}
              inactiveProps={{ className: "mw-admin-navlink" }}
              data-testid={navTestId(item.label)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {typeof item.count === "number" ? (
                <em className="mw-admin-navcount">{item.count}</em>
              ) : null}
            </Link>
          ))}
        </nav>

        <p className="mw-admin-navlabel">Next phases</p>
        <ul className="mw-admin-navlocked">
          {LOCKED.map((item) => (
            <li key={item.label}>
              <item.icon size={15} />
              <span>{item.label}</span>
              <small>{item.phase}</small>
            </li>
          ))}
        </ul>

        <div className="mw-admin-sidefoot" data-testid="admin-role-foot">
          <ShieldCheck size={15} />
          <div>
            <strong>{sessionRoleLabel(session)}</strong>
            <span>{ADMIN_SOURCE_LABEL[session.source]}</span>
          </div>
        </div>
      </aside>

      <div className="mw-admin-body">
        <header className="mw-admin-topbar">
          <div className="mw-admin-topbar-lead">
            <span className="mw-admin-topbartag">
              <Activity size={13} /> Live
            </span>
            <div>
              <h1 data-testid="admin-page-title">{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          <div className="mw-admin-topbar-actions">
            {actions}
            <div className="mw-admin-user">
              <span className="mw-admin-avatar" aria-hidden="true">
                {initials(session.name)}
              </span>
              <span className="mw-admin-usertext">
                <strong>{session.name}</strong>
                <small data-testid="admin-user-role">{sessionRoleLabel(session)}</small>
              </span>
            </div>
            <button
              type="button"
              className="mw-admin-signout"
              onClick={() => signOutAdmin()}
              data-testid="admin-signout"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        <main className="mw-admin-main">{children}</main>
      </div>
    </div>
  );
}
