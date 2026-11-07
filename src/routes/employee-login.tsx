import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Building2, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";

import {
  demoDeskAccounts,
  signInDemoDesk,
  signInEmployee,
  useEmployeeSession,
} from "@/lib/employee-auth";
import { DESK_LABEL, deskForEmployee, type DeskKey } from "@/lib/employee-desk";

export const Route = createFileRoute("/employee-login")({
  head: () => ({
    meta: [
      { title: "Employee Sign In | Motor Wallah" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EmployeeLoginPage,
});

function EmployeeLoginPage() {
  const { ready, session } = useEmployeeSession();
  const navigate = useNavigate();

  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/employee", replace: true });
  }, [ready, session, navigate]);

  const demos = demoDeskAccounts();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await signInEmployee(identity, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: "/employee", replace: true });
    } catch {
      setError("Sign-in could not complete. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mw-admin mw-employee-gate">
      <div className="mw-admin-gate-wrap">
        <section className="mw-admin-gate-intro">
          <span className="mw-admin-eyebrow">
            <Building2 size={15} /> Employee Desk
          </span>
          <h1 className="mw-admin-gate-title">
            Your desk. <em>Only</em> your desk.
          </h1>
          <p className="mw-admin-gate-text">
            One sign-in for every department. The board you see is decided by the department and
            category your admin assigned — sales leads, workshop job cards, parts orders or finance
            and insurance applications.
          </p>
          <ul className="mw-admin-gate-list">
            <li>
              <span>01</span> Employee ID and password issued by the administrator
            </li>
            <li>
              <span>02</span> Department scope is fixed at sign-in, not chosen in the UI
            </li>
            <li>
              <span>03</span> Every status change is attributed and mirrored to the Master Tracker
            </li>
          </ul>
        </section>

        <section className="mw-admin-gate-card" aria-labelledby="employee-login-title">
          <div className="mw-admin-gate-cardhead">
            <div>
              <h2 id="employee-login-title">Employee sign in</h2>
              <p>Use the work email or employee ID your administrator created for you.</p>
            </div>
            <span className="mw-admin-badge">Staff</span>
          </div>

          <form className="mw-admin-form" onSubmit={handleSubmit} noValidate>
            <label className="mw-admin-field">
              <span>Work email or employee ID</span>
              <div className="mw-admin-input">
                <UserRound size={16} />
                <input
                  type="text"
                  name="identity"
                  autoComplete="username"
                  placeholder="priyanka.shah@motorwallah.in or EMP-1004"
                  value={identity}
                  onChange={(event) => setIdentity(event.target.value)}
                  data-testid="employee-identity"
                  required
                />
              </div>
            </label>

            <label className="mw-admin-field">
              <span>Password</span>
              <div className="mw-admin-input">
                <KeyRound size={16} />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  data-testid="employee-password"
                  required
                />
              </div>
            </label>

            {error ? (
              <p className="mw-admin-error" role="alert" data-testid="employee-error">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="mw-admin-submit"
              disabled={busy}
              data-testid="employee-submit"
            >
              {busy ? "Verifying…" : "Open my desk"}
              <ArrowRight size={17} />
            </button>
          </form>

          {demos.length > 0 ? (
            <div className="mw-employee-demo">
              <p>
                <ShieldCheck size={15} /> Demo desks — seeded employees with no password set yet.
              </p>
              <div className="mw-employee-demo-grid">
                {demos.map((employee) => {
                  const desk = deskForEmployee(employee.department, employee.category) as DeskKey;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      className="mw-employee-demobutton"
                      onClick={() => {
                        const result = signInDemoDesk(employee.id);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        void navigate({ to: "/employee", replace: true });
                      }}
                      data-testid={`employee-demo-${desk}`}
                    >
                      <span>{DESK_LABEL[desk]}</span>
                      <strong>
                        {employee.name} · {employee.id}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mw-admin-gate-foot">
            <span>
              Administrators manage employees at{" "}
              <Link to="/master-admin/employees">Master Admin → Employees</Link>.
            </span>
            <Link to="/">
              <LogOut size={13} /> Back to Motor Wallah
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
