import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { ADMIN_SOURCE_LABEL, signOutAdmin, type AdminSession } from "@/lib/admin-auth";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  count?: number;
};

const LOCKED: { label: string; icon: typeof LayoutDashboard; phase: string }[] = [
  { label: "Inventory & Listings", icon: Boxes, phase: "Phase 2" },
  { label: "Finance Desk", icon: Wallet, phase: "Phase 2" },
  { label: "Employees & Roles", icon: Users, phase: "Phase 3" },
  { label: "Reports & Analytics", icon: BarChart3, phase: "Phase 3" },
  { label: "Partners & Studios", icon: Building2, phase: "Phase 3" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export function AdminShell({
  session,
  title,
  subtitle,
  actions,
  children,
  openCount,
}: {
  session: AdminSession;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
  openCount?: number;
}) {
  const nav: NavItem[] = [
    { to: "/master-admin", label: "Overview", icon: LayoutDashboard, exact: true },
    {
      to: "/master-admin/tracker",
      label: "Master Tracker",
      icon: ClipboardList,
      ...(typeof openCount === "number" ? { count: openCount } : {}),
    },
  ];

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

        <p className="mw-admin-navlabel">Phase 1 · Foundation</p>
        <nav className="mw-admin-nav" aria-label="Control room sections">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="mw-admin-navlink"
              activeProps={{ className: "mw-admin-navlink is-active", "aria-current": "page" }}
              data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
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

        <div className="mw-admin-sidefoot">
          <ShieldCheck size={15} />
          <div>
            <strong>{session.role === "owner" ? "Owner access" : session.role}</strong>
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
                <small>{session.email}</small>
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
