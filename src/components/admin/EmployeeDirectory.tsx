import { useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import {
  createEmployee,
  employeeName,
  ensureAdminDatabase,
  nextEmployeeId,
  openCasesFor,
  relativeTime,
  resetEmployeePassword,
  setEmployeeStatus,
  subscribeToAdminData,
  updateEmployee,
  visibleEmployees,
  type AdminEmployee,
  type EmployeeInput,
  type EmployeeStatus,
} from "@/lib/admin-crm";
import {
  DEPARTMENTS,
  DEPARTMENT_CASE_TYPES,
  DEPARTMENT_HINT,
  ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  actorFromSession,
  can,
  type Actor,
  type Department,
  type Role,
} from "@/lib/admin-rbac";
import type { AdminSession } from "@/lib/admin-auth";

type Mode = "create" | "edit" | "password";

const EMPTY_FORM = {
  name: "",
  email: "",
  mobile: "",
  department: "Finance" as Department,
  role: "executive" as Role,
  status: "Active" as EmployeeStatus,
  password: "",
};

export function EmployeeDirectory({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department | "all">("all");
  const [role, setRole] = useState<Role | "all">("all");
  const [status, setStatus] = useState<EmployeeStatus | "all">("all");
  const [mode, setMode] = useState<Mode | null>(null);
  const [editing, setEditing] = useState<AdminEmployee | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    return subscribeToAdminData(refresh);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const data = useMemo(() => {
    void version;
    return ensureAdminDatabase();
  }, [version]);

  const employees = useMemo(() => visibleEmployees(actor, data.employees), [actor, data.employees]);
  const mayManage = can(actor, "employee.manage");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees
      .filter((item) => department === "all" || item.department === department)
      .filter((item) => role === "all" || item.role === role)
      .filter((item) => status === "all" || item.status === status)
      .filter((item) =>
        needle
          ? [item.id, item.name, item.email, item.mobile, item.department]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [employees, query, department, role, status]);

  const openDrawer = (nextMode: Mode, employee: AdminEmployee | null) => {
    setError(null);
    setMode(nextMode);
    setEditing(employee);
    setForm(
      employee
        ? {
            name: employee.name,
            email: employee.email,
            mobile: employee.mobile,
            department: employee.department,
            role: employee.role,
            status: employee.status,
            password: "",
          }
        : { ...EMPTY_FORM },
    );
  };

  const closeDrawer = () => {
    setMode(null);
    setEditing(null);
    setError(null);
  };

  const input: EmployeeInput = {
    name: form.name,
    email: form.email,
    mobile: form.mobile,
    department: form.department,
    role: form.role,
    status: form.status,
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    if (mode === "create") {
      const result = await createEmployee({ ...input, password: form.password }, actor);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      closeDrawer();
      setFlash(
        `${result.employee.name} added as ${result.employee.id} (${result.employee.department} · ${ROLE_LABEL[result.employee.role]}).`,
      );
    } else if (mode === "edit" && editing) {
      const result = updateEmployee(editing.id, input, actor);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      closeDrawer();
      setFlash(`${result.employee.name} (${result.employee.id}) updated.`);
    } else if (mode === "password" && editing) {
      const result = await resetEmployeePassword(editing.id, form.password, actor);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      closeDrawer();
      setFlash(`Password reset for ${result.employee.name}. Share it privately.`);
    }
    setBusy(false);
  };

  const toggleStatus = (employee: AdminEmployee) => {
    const next: EmployeeStatus = employee.status === "Active" ? "Disabled" : "Active";
    const result = setEmployeeStatus(employee.id, next, actor);
    if (!result.ok) {
      setFlash(null);
      setError(result.error);
      return;
    }
    setError(null);
    setFlash(
      next === "Disabled"
        ? `${employee.name} can no longer sign in. Their cases stay on the tracker.`
        : `${employee.name} can sign in again.`,
    );
  };

  return (
    <div className="mw-admin-directory" data-testid="employee-directory">
      <section className="mw-admin-toolbar" aria-label="Employee filters">
        <div className="mw-admin-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search name, email, employee ID…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search employees"
            data-testid="employee-search"
          />
        </div>
        <div className="mw-admin-quickfilters">
          <label className="mw-admin-select">
            <span className="sr-only">Department</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value as Department | "all")}
              data-testid="employee-filter-department"
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mw-admin-select">
            <span className="sr-only">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role | "all")}
              data-testid="employee-filter-role"
            >
              <option value="all">All roles</option>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="mw-admin-select">
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as EmployeeStatus | "all")}
              data-testid="employee-filter-status"
            >
              <option value="all">Any status</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
          </label>
          {mayManage ? (
            <button
              type="button"
              className="mw-admin-primary"
              onClick={() => openDrawer("create", null)}
              data-testid="employee-add"
            >
              <Plus size={15} /> Add employee
            </button>
          ) : (
            <span className="mw-admin-lockednote" data-testid="employee-readonly">
              <ShieldCheck size={14} /> {ROLE_LABEL[actor.role]} — directory is read-only for you.
            </span>
          )}
        </div>
      </section>

      {flash ? (
        <p className="mw-admin-flash" role="status" data-testid="employee-flash">
          <Check size={14} /> {flash}
        </p>
      ) : null}
      {error && !mode ? (
        <p className="mw-admin-error" role="alert" data-testid="employee-error">
          {error}
        </p>
      ) : null}

      <section className="mw-admin-tablewrap" aria-label="Employee directory">
        <table className="mw-admin-table mw-admin-table--people" data-testid="employee-table">
          <thead>
            <tr>
              <th scope="col">Employee ID</th>
              <th scope="col">Name</th>
              <th scope="col">Mobile</th>
              <th scope="col">Department</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Open cases</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => {
              const open = openCasesFor(data.cases, employee.id).length;
              return (
                <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                  <td data-label="Employee ID">
                    <strong className="mw-admin-caseid">{employee.id}</strong>
                  </td>
                  <td data-label="Name">
                    <span className="mw-admin-customer">{employee.name}</span>
                    <small className="mw-admin-vehicle">{employee.email}</small>
                  </td>
                  <td data-label="Mobile">{employee.mobile}</td>
                  <td data-label="Department">
                    <span className="mw-admin-dept">{employee.department}</span>
                  </td>
                  <td data-label="Role">
                    <span className={`mw-admin-role is-${employee.role.replace(/_/g, "-")}`}>
                      {ROLE_LABEL[employee.role]}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`mw-admin-empstatus is-${employee.status.toLowerCase()}`}
                      data-testid={`employee-status-${employee.id}`}
                    >
                      {employee.status}
                    </span>
                    {!employee.credential ? (
                      <span className="mw-admin-empstatus is-pending">No password</span>
                    ) : null}
                  </td>
                  <td data-label="Open cases">{open}</td>
                  <td data-label="Last sign-in">
                    {employee.lastLoginAt ? relativeTime(employee.lastLoginAt) : "Never"}
                  </td>
                  <td data-label="Actions">
                    {mayManage ? (
                      <div className="mw-admin-rowactions">
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => openDrawer("edit", employee)}
                          data-testid={`employee-edit-${employee.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mw-admin-view"
                          onClick={() => openDrawer("password", employee)}
                          data-testid={`employee-reset-${employee.id}`}
                          aria-label={`Reset password for ${employee.name}`}
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          type="button"
                          className={`mw-admin-view${employee.status === "Active" ? " is-danger" : ""}`}
                          onClick={() => toggleStatus(employee)}
                          data-testid={`employee-toggle-${employee.id}`}
                          aria-label={`${employee.status === "Active" ? "Disable" : "Enable"} ${employee.name}`}
                        >
                          {employee.status === "Active" ? (
                            <UserX size={13} />
                          ) : (
                            <UserPlus size={13} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="mw-admin-unassigned">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="mw-admin-empty is-big" data-testid="employee-empty">
            No employees match these filters.
          </div>
        ) : null}
      </section>

      <section className="mw-admin-counters" aria-label="Directory totals">
        <span>
          <UserCog size={14} /> <strong data-testid="employee-total">{rows.length}</strong>{" "}
          employees
        </span>
        <span>
          <strong>{rows.filter((item) => item.status === "Active").length}</strong> active
        </span>
        <span>
          <strong>{rows.filter((item) => item.status === "Disabled").length}</strong> disabled
        </span>
      </section>

      {mode ? (
        <EmployeeDrawer
          mode={mode}
          employee={editing}
          form={form}
          setForm={setForm}
          error={error}
          busy={busy}
          nextId={nextEmployeeId(data.employees)}
          employeeLabel={employeeName(data.employees, editing?.id ?? null)}
          onSave={() => void save()}
          onClose={closeDrawer}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ drawer */

type FormState = typeof EMPTY_FORM;

function EmployeeDrawer({
  mode,
  employee,
  form,
  setForm,
  error,
  busy,
  nextId,
  employeeLabel,
  onSave,
  onClose,
}: {
  mode: Mode;
  employee: AdminEmployee | null;
  form: FormState;
  setForm: (next: FormState) => void;
  error: string | null;
  busy: boolean;
  nextId: string;
  employeeLabel: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  const title =
    mode === "create"
      ? "Add employee"
      : mode === "edit"
        ? (employeeLabel ?? "Edit employee")
        : "Reset password";

  return (
    <div className="mw-admin-drawer-root" data-testid="employee-drawer">
      <button
        type="button"
        className="mw-admin-drawer-backdrop"
        onClick={onClose}
        aria-label="Close employee form"
        tabIndex={-1}
      />
      <aside className="mw-admin-drawer is-narrow" role="dialog" aria-modal="true">
        <header className="mw-admin-drawer-head">
          <div>
            <span className="mw-admin-type">
              {mode === "create" ? "New record" : (employee?.id ?? "Employee")}
            </span>
            <h2>{title}</h2>
            <p>
              {mode === "create"
                ? `Employee ID ${nextId} is assigned automatically.`
                : mode === "edit"
                  ? "Changes are recorded in the audit log."
                  : "Set a temporary password and share it privately."}
            </p>
          </div>
          <button
            type="button"
            className="mw-admin-drawer-close"
            onClick={onClose}
            aria-label="Close employee form"
            data-testid="employee-cancel"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mw-admin-drawer-body">
          {error ? (
            <p className="mw-admin-error" role="alert" data-testid="employee-form-error">
              {error}
            </p>
          ) : null}

          {mode === "password" ? (
            <section className="mw-admin-drawersection">
              <h3>
                <KeyRound size={15} /> Temporary password
              </h3>
              <label className="mw-admin-field">
                <span>Password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => set("password", event.target.value)}
                  placeholder="At least 10 characters, letters and a number"
                  autoComplete="new-password"
                  data-testid="employee-password"
                />
              </label>
              <p className="mw-admin-hint">
                Stored as a salted PBKDF2 hash. The employee signs in at /master-admin/login.
              </p>
            </section>
          ) : (
            <>
              <section className="mw-admin-drawersection">
                <h3>
                  <UserCog size={15} /> Employee details
                </h3>
                <div className="mw-admin-formgrid">
                  <label className="mw-admin-field is-wide">
                    <span>Full name</span>
                    <input
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      placeholder="e.g. Neha Kulkarni"
                      data-testid="employee-name"
                    />
                  </label>
                  <label className="mw-admin-field">
                    <span>
                      <Mail size={12} /> Work email
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => set("email", event.target.value)}
                      placeholder="name@motorwallah.in"
                      data-testid="employee-email"
                    />
                  </label>
                  <label className="mw-admin-field">
                    <span>
                      <Phone size={12} /> Mobile
                    </span>
                    <input
                      value={form.mobile}
                      onChange={(event) => set("mobile", event.target.value)}
                      placeholder="10-digit number"
                      inputMode="tel"
                      data-testid="employee-mobile"
                    />
                  </label>
                  <label className="mw-admin-field">
                    <span>Department</span>
                    <select
                      value={form.department}
                      onChange={(event) => set("department", event.target.value as Department)}
                      data-testid="employee-department"
                    >
                      {DEPARTMENTS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mw-admin-field">
                    <span>Role</span>
                    <select
                      value={form.role}
                      onChange={(event) => set("role", event.target.value as Role)}
                      data-testid="employee-role"
                    >
                      {ROLES.map((item) => (
                        <option key={item} value={item}>
                          {ROLE_LABEL[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mw-admin-field">
                    <span>Status</span>
                    <select
                      value={form.status}
                      onChange={(event) => set("status", event.target.value as EmployeeStatus)}
                      data-testid="employee-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </label>
                </div>
                <p className="mw-admin-hint" data-testid="employee-desk-hint">
                  Sees{" "}
                  {DEPARTMENT_CASE_TYPES[form.department].length
                    ? `${DEPARTMENT_CASE_TYPES[form.department].join(", ")} cases`
                    : "no case queues (systems only)"}
                  {" — "}
                  {DEPARTMENT_HINT[form.department].toLowerCase()}.
                </p>
                <p className="mw-admin-hint">{ROLE_HINT[form.role]}</p>
              </section>

              {mode === "create" ? (
                <section className="mw-admin-drawersection">
                  <h3>
                    <KeyRound size={15} /> Temporary password
                  </h3>
                  <label className="mw-admin-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => set("password", event.target.value)}
                      placeholder="At least 10 characters, letters and a number"
                      autoComplete="new-password"
                      data-testid="employee-password"
                    />
                  </label>
                  <p className="mw-admin-hint">
                    The employee signs in with this email and password. You can reset it later.
                  </p>
                </section>
              ) : null}
            </>
          )}

          <div className="mw-admin-drawerfoot">
            <button
              type="button"
              className="mw-admin-primary"
              onClick={onSave}
              disabled={busy}
              data-testid="employee-save"
            >
              {busy
                ? "Saving…"
                : mode === "create"
                  ? "Create employee"
                  : mode === "edit"
                    ? "Save changes"
                    : "Reset password"}
            </button>
            <button type="button" className="mw-admin-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
