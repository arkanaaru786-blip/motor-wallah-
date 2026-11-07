import { useEffect } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  ApplicationTrackerView,
  OrderFulfilmentView,
  SalesLeadsView,
  WorkshopBoard,
} from "@/components/employee/DeskViews";
import {
  currentEmployee,
  employeeActor,
  employeeDeskLabel,
  signOutEmployee,
  useEmployeeSession,
} from "@/lib/employee-auth";
import { DESK_LABEL, DESK_SUBTITLE } from "@/lib/employee-desk";
import { ROLE_LABEL } from "@/lib/admin-rbac";

/**
 * Universal Employee Dashboard.
 *
 * The department view is chosen from the session the admin assigned — never
 * from a query string — and the desk data layer repeats the check on every
 * read and write.
 */
export const Route = createFileRoute("/employee")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!currentEmployee()) throw redirect({ to: "/employee-login" });
  },
  head: () => ({
    meta: [
      { title: "Employee Dashboard | Motor Wallah" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EmployeeDashboard,
});

function EmployeeDashboard() {
  const { ready, session } = useEmployeeSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) void navigate({ to: "/employee-login", replace: true });
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="mw-admin mw-admin-loading" aria-busy="true">
        <span className="mw-admin-loading-dot" />
        Opening your desk…
      </div>
    );
  }

  const actor = employeeActor(session);
  const desk = session.desk;

  return (
    <div className="mw-admin mw-employee">
      <div className="mw-employee-shell">
        <header className="mw-employee-top">
          <div className="mw-employee-brand">
            <span className="mw-employee-mark">
              <Building2 size={18} />
            </span>
            <div>
              <strong>{desk ? DESK_LABEL[desk] : "Employee Dashboard"}</strong>
              <small>{desk ? DESK_SUBTITLE[desk] : "Your department has no desk board yet."}</small>
            </div>
          </div>

          <div className="mw-employee-user">
            <div className="mw-employee-scope">
              <ShieldCheck size={14} />
              {employeeDeskLabel(session)}
            </div>
            <div className="mw-employee-who">
              <strong>{session.name}</strong>
              <small>
                {session.employeeId} · {ROLE_LABEL[session.role]}
                {session.demo ? " · Demo" : ""}
              </small>
            </div>
            <button
              className="mw-employee-signout"
              onClick={() => {
                signOutEmployee();
                void navigate({ to: "/employee-login", replace: true });
              }}
              data-testid="employee-signout"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </header>

        <main className="mw-employee-main">
          {desk === "sales" ? <SalesLeadsView actor={actor} /> : null}
          {desk === "workshop" ? <WorkshopBoard actor={actor} /> : null}
          {desk === "parts" ? <OrderFulfilmentView actor={actor} /> : null}
          {desk === "finance" ? <ApplicationTrackerView actor={actor} desk="finance" /> : null}
          {desk === "insurance" ? <ApplicationTrackerView actor={actor} desk="insurance" /> : null}

          {!desk ? (
            <div className="mw-desk-empty is-big">
              <ShieldAlert size={22} />
              <strong>No desk assigned</strong>
              <p>
                Your account is in <b>{session.department}</b>, which does not have an employee
                board yet. Ask the administrator to assign you to Vehicle Sales, Workshop, Parts &
                Decor, Finance or Insurance.
              </p>
              <Link to="/">Return to the website</Link>
            </div>
          ) : null}
        </main>

        <footer className="mw-employee-foot">
          <span>
            Signed in as {session.name} · {session.employeeId}. Scope: {employeeDeskLabel(session)}.
          </span>
          <Link to="/">motorwallah.in</Link>
        </footer>
      </div>
    </div>
  );
}
