import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Filter,
  ListChecks,
  Lock,
  MessageSquarePlus,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
  addCaseNote,
  assignCase,
  assignableEmployees,
  employeeName,
  ensureAdminDatabase,
  inr,
  isOpenStatus,
  relativeTime,
  shortDate,
  slaFor,
  subscribeToAdminData,
  updateCaseStatus,
  visibleCases,
  type AdminEmployee,
  type CasePriority,
  type CaseStatus,
  type CaseType,
  type CrmCase,
} from "@/lib/admin-crm";
import {
  ROLE_LABEL,
  actorFromSession,
  canAssignCase,
  canEditCase,
  canViewAllTasks,
  scopeLabel,
  visibleCaseTypes,
  type Actor,
} from "@/lib/admin-rbac";
import type { AdminSession } from "@/lib/admin-auth";

type Filters = {
  q: string;
  type: CaseType | "all";
  status: CaseStatus | "all";
  priority: CasePriority | "all";
  assignee: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  type: "all",
  status: "all",
  priority: "all",
  assignee: "all",
  from: "",
  to: "",
};

const PAGE_SIZES = [10, 25, 50] as const;

export type TaskScope = "my" | "all";

export function MasterTracker({
  session,
  caseId,
  scope,
  onScopeChange,
  onCaseChange,
}: {
  session: AdminSession;
  caseId: string | null;
  scope: TaskScope;
  onScopeChange: (scope: TaskScope) => void;
  onCaseChange: (id: string | null) => void;
}) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [openFilters, setOpenFilters] = useState(false);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    return subscribeToAdminData(refresh);
  }, []);

  const data = useMemo(() => {
    void version;
    return ensureAdminDatabase();
  }, [version]);

  /** Everything this person is allowed to see, before the toolbar filters. */
  const permitted = useMemo(() => visibleCases(actor, data.cases), [actor, data.cases]);
  const allTasksAvailable = canViewAllTasks(actor);

  const scoped = useMemo(
    () => (scope === "my" ? permitted.filter((item) => item.assignedTo === actor.id) : permitted),
    [permitted, scope, actor.id],
  );

  const typeOptions = useMemo(() => {
    const allowed = new Set(visibleCaseTypes(actor));
    return CASE_TYPES.filter((type) => allowed.has(type));
  }, [actor]);

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    const from = filters.from ? Date.parse(`${filters.from}T00:00:00`) : null;
    const to = filters.to ? Date.parse(`${filters.to}T23:59:59`) : null;

    return scoped
      .filter((item) => filters.type === "all" || item.type === filters.type)
      .filter((item) => filters.status === "all" || item.status === filters.status)
      .filter((item) => filters.priority === "all" || item.priority === filters.priority)
      .filter((item) => {
        if (filters.assignee === "all") return true;
        if (filters.assignee === "unassigned") return !item.assignedTo;
        return item.assignedTo === filters.assignee;
      })
      .filter((item) => {
        const created = Date.parse(item.createdAt);
        if (from !== null && created < from) return false;
        if (to !== null && created > to) return false;
        return true;
      })
      .filter((item) => {
        if (!needle) return true;
        const owner = employeeName(data.employees, item.assignedTo) ?? "";
        return [
          item.id,
          item.customerName,
          item.mobile,
          item.vehicle ?? "",
          item.source,
          item.summary,
          owner,
          item.type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [scoped, data.employees, filters]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const now = Date.now();

  const activeFilterCount = [
    filters.type !== "all",
    filters.status !== "all",
    filters.priority !== "all",
    filters.assignee !== "all",
    Boolean(filters.from),
    Boolean(filters.to),
  ].filter(Boolean).length;

  const selected = caseId ? (data.cases.find((item) => item.id === caseId) ?? null) : null;
  const selectedVisible = selected && permitted.some((item) => item.id === selected.id);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const stats = {
    open: filtered.filter((item) => isOpenStatus(item.status)).length,
    overdue: filtered.filter((item) => slaFor(item, now).state === "Overdue").length,
    unassigned: filtered.filter((item) => !item.assignedTo && isOpenStatus(item.status)).length,
  };

  return (
    <div className="mw-admin-tracker" data-testid="master-tracker">
      <section className="mw-admin-scope" data-testid="tracker-scope-banner">
        <span className="mw-admin-scope-icon">
          <ShieldCheck size={15} />
        </span>
        <div>
          <strong data-testid="tracker-scope-label">{scopeLabel(actor)}</strong>
          <small>
            {ROLE_LABEL[actor.role]} · {actor.id}
            {allTasksAvailable
              ? " — you can switch between your own queue and the full desk."
              : " — your role only sees work assigned to you."}
          </small>
        </div>
        <div className="mw-admin-scope-switch" role="group" aria-label="Task scope">
          <button
            type="button"
            className={scope === "my" ? "is-on" : ""}
            aria-pressed={scope === "my"}
            onClick={() => {
              onScopeChange("my");
              setPage(1);
            }}
            data-testid="scope-my"
          >
            <ListChecks size={14} /> My tasks
          </button>
          <button
            type="button"
            className={scope === "all" ? "is-on" : ""}
            aria-pressed={scope === "all"}
            disabled={!allTasksAvailable}
            title={allTasksAvailable ? undefined : "Your role can only see work assigned to you."}
            onClick={() => {
              if (!allTasksAvailable) return;
              onScopeChange("all");
              setPage(1);
            }}
            data-testid="scope-all"
          >
            {allTasksAvailable ? <ClipboardList size={14} /> : <Lock size={13} />} All tasks
          </button>
        </div>
      </section>

      <section className="mw-admin-toolbar" aria-label="Tracker filters">
        <div className="mw-admin-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search case ID, name, mobile, vehicle…"
            value={filters.q}
            onChange={(event) => set("q", event.target.value)}
            aria-label="Search cases"
            data-testid="tracker-search"
          />
        </div>

        <div className="mw-admin-quickfilters">
          <label className="mw-admin-select">
            <span className="sr-only">Case type</span>
            <select
              value={filters.type}
              onChange={(event) => set("type", event.target.value as Filters["type"])}
              data-testid="filter-type"
            >
              <option value="all">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="mw-admin-select">
            <span className="sr-only">Status</span>
            <select
              value={filters.status}
              onChange={(event) => set("status", event.target.value as Filters["status"])}
              data-testid="filter-status"
            >
              <option value="all">All statuses</option>
              {CASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`mw-admin-ghost${openFilters ? " is-on" : ""}`}
            onClick={() => setOpenFilters((value) => !value)}
            aria-expanded={openFilters}
            data-testid="toggle-filters"
          >
            <SlidersHorizontal size={15} /> Filters
            {activeFilterCount ? <em>{activeFilterCount}</em> : null}
          </button>

          {activeFilterCount || filters.q ? (
            <button
              type="button"
              className="mw-admin-ghost is-subtle"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              data-testid="reset-filters"
            >
              <RotateCcw size={14} /> Reset
            </button>
          ) : null}
        </div>
      </section>

      {openFilters ? (
        <section className="mw-admin-advanced" aria-label="Advanced filters">
          <label>
            <span>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) => set("priority", event.target.value as Filters["priority"])}
              data-testid="filter-priority"
            >
              <option value="all">Any priority</option>
              {CASE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Assigned to</span>
            <select
              value={filters.assignee}
              onChange={(event) => set("assignee", event.target.value)}
              data-testid="filter-assignee"
            >
              <option value="all">Anyone</option>
              {allTasksAvailable ? <option value="unassigned">Unassigned</option> : null}
              {data.employees
                .filter((employee) => permitted.some((item) => item.assignedTo === employee.id))
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Created from</span>
            <div className="mw-admin-date">
              <CalendarDays size={14} />
              <input
                type="date"
                value={filters.from}
                onChange={(event) => set("from", event.target.value)}
                data-testid="filter-from"
              />
            </div>
          </label>
          <label>
            <span>Created to</span>
            <div className="mw-admin-date">
              <CalendarDays size={14} />
              <input
                type="date"
                value={filters.to}
                onChange={(event) => set("to", event.target.value)}
                data-testid="filter-to"
              />
            </div>
          </label>
        </section>
      ) : null}

      <section className="mw-admin-counters" aria-label="Filtered totals">
        <span>
          <ClipboardList size={14} /> <strong data-testid="tracker-total">{total}</strong> cases
        </span>
        <span>
          <Filter size={14} /> <strong>{stats.open}</strong> open
        </span>
        <span className={stats.overdue ? "is-alert" : ""}>
          <strong>{stats.overdue}</strong> overdue
        </span>
        <span>
          <strong>{stats.unassigned}</strong> unassigned
        </span>
      </section>

      <section className="mw-admin-tablewrap" aria-label="All business cases">
        <table className="mw-admin-table" data-testid="tracker-table">
          <thead>
            <tr>
              <th scope="col">Case ID</th>
              <th scope="col">Type</th>
              <th scope="col">Customer</th>
              <th scope="col">Mobile</th>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Assigned to</th>
              <th scope="col">Created</th>
              <th scope="col">SLA</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const sla = slaFor(item, now);
              return (
                <tr
                  key={item.id}
                  onClick={() => onCaseChange(item.id)}
                  data-testid={`case-row-${item.id}`}
                >
                  <td data-label="Case ID">
                    <strong className="mw-admin-caseid">{item.id}</strong>
                  </td>
                  <td data-label="Type">
                    <span
                      className={`mw-admin-type is-${item.type.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td data-label="Customer">
                    <span className="mw-admin-customer">{item.customerName}</span>
                    {item.vehicle ? (
                      <small className="mw-admin-vehicle">{item.vehicle}</small>
                    ) : null}
                  </td>
                  <td data-label="Mobile">
                    <a href={`tel:${item.mobile}`} onClick={(event) => event.stopPropagation()}>
                      {item.mobile}
                    </a>
                  </td>
                  <td data-label="Source">{item.source}</td>
                  <td data-label="Status">
                    <span
                      className={`mw-admin-status is-${item.status.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td data-label="Priority">
                    <span className={`mw-admin-priority is-${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td data-label="Assigned to">
                    {employeeName(data.employees, item.assignedTo) ?? (
                      <span className="mw-admin-unassigned">Unassigned</span>
                    )}
                  </td>
                  <td data-label="Created">{shortDate(item.createdAt)}</td>
                  <td data-label="SLA">
                    <span
                      className={`mw-admin-sla is-${sla.state.toLowerCase().replace(" ", "-")}`}
                    >
                      {sla.label}
                    </span>
                  </td>
                  <td data-label="Action">
                    <button
                      type="button"
                      className="mw-admin-view"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCaseChange(item.id);
                      }}
                      data-testid={`view-case-${item.id}`}
                    >
                      View <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="mw-admin-empty is-big" data-testid="tracker-empty">
            {scope === "my"
              ? "No cases are assigned to you yet. A manager can hand you work from All tasks."
              : "No cases match these filters. Try a different type, status or date range."}
          </div>
        ) : null}
      </section>

      <nav className="mw-admin-pagination" aria-label="Case pagination">
        <span data-testid="tracker-range">
          {total === 0 ? "No results" : `Showing ${start + 1}–${start + rows.length} of ${total}`}
        </span>
        <div className="mw-admin-pagination-controls">
          <label className="mw-admin-select is-small">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              data-testid="page-size"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mw-admin-page"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="mw-admin-pagecount">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            className="mw-admin-page"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {selected && selectedVisible ? (
        <CaseDrawer
          key={selected.id}
          item={selected}
          employees={data.employees}
          actor={actor}
          onClose={() => onCaseChange(null)}
        />
      ) : null}

      {selected && !selectedVisible ? (
        <CaseDeniedDrawer itemId={selected.id} onClose={() => onCaseChange(null)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ drawer */

function CaseDeniedDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  return (
    <div className="mw-admin-drawer-root" data-testid="case-drawer-denied">
      <button
        type="button"
        className="mw-admin-drawer-backdrop"
        onClick={onClose}
        aria-label="Close case details"
        tabIndex={-1}
      />
      <aside className="mw-admin-drawer" role="dialog" aria-modal="true">
        <header className="mw-admin-drawer-head">
          <div>
            <span className="mw-admin-type">Restricted</span>
            <h2>{itemId}</h2>
            <p>This case sits outside your department.</p>
          </div>
          <button
            type="button"
            className="mw-admin-drawer-close"
            onClick={onClose}
            aria-label="Close case details"
          >
            <X size={18} />
          </button>
        </header>
        <div className="mw-admin-drawer-body">
          <p className="mw-admin-denied" data-testid="drawer-denied-message">
            <Lock size={16} /> Your role can only open cases on your own desk. Ask a super admin if
            you need access.
          </p>
        </div>
      </aside>
    </div>
  );
}

function CaseDrawer({
  item,
  employees,
  actor,
  onClose,
}: {
  item: CrmCase;
  employees: AdminEmployee[];
  actor: Actor;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<CaseStatus>(item.status);
  const [assignee, setAssignee] = useState<string>(item.assignedTo ?? "");
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
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

  const note2 = (message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2600);
  };

  const sla = slaFor(item);
  const mayEdit = canEditCase(actor, item);
  const mayAssign = canAssignCase(actor, item);
  const canTakeWork = assignableEmployees(actor, employees, item.type);

  const saveStatus = () => {
    setError(null);
    const result = updateCaseStatus(item.id, status, actor);
    if (!result.ok) {
      setError(result.error ?? "Could not update this case.");
      return;
    }
    note2(`Status updated to ${status}.`);
  };

  const saveAssignee = () => {
    setError(null);
    const result = assignCase(item.id, assignee || null, actor);
    if (!result.ok) {
      setError(result.error ?? "Could not update this case.");
      return;
    }
    note2(assignee ? "Case assigned." : "Case moved back to the unassigned queue.");
  };

  const saveNote = () => {
    setError(null);
    const result = addCaseNote(item.id, note, actor);
    if (!result.ok) {
      setError(result.error ?? "Could not save that note.");
      return;
    }
    setNote("");
    note2("Note saved to the case.");
  };

  return (
    <div className="mw-admin-drawer-root" data-testid="case-drawer">
      <button
        type="button"
        className="mw-admin-drawer-backdrop"
        onClick={onClose}
        aria-label="Close case details"
        tabIndex={-1}
      />
      <aside
        className="mw-admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
      >
        <header className="mw-admin-drawer-head">
          <div>
            <span className={`mw-admin-type is-${item.type.toLowerCase().replace(/\s+/g, "-")}`}>
              {item.type}
            </span>
            <h2 id="case-drawer-title">{item.customerName}</h2>
            <p>
              {item.id} · created {relativeTime(item.createdAt)}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="mw-admin-drawer-close"
            onClick={onClose}
            aria-label="Close case details"
            data-testid="close-drawer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mw-admin-drawer-body">
          <div className="mw-admin-factgrid">
            <div>
              <span>Customer</span>
              <strong>{item.customerName}</strong>
            </div>
            <div>
              <span>Mobile</span>
              <strong>
                <a href={`tel:${item.mobile}`}>
                  <Phone size={13} /> {item.mobile}
                </a>
              </strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{item.source}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{shortDate(item.createdAt)}</strong>
            </div>
            <div>
              <span>SLA</span>
              <strong>
                <span className={`mw-admin-sla is-${sla.state.toLowerCase().replace(" ", "-")}`}>
                  {sla.label}
                </span>
              </strong>
            </div>
            <div>
              <span>Deal value</span>
              <strong>{item.value ? inr(item.value) : "—"}</strong>
            </div>
            <div className="is-wide">
              <span>Vehicle / subject</span>
              <strong>{item.vehicle ?? "—"}</strong>
            </div>
            <div className="is-wide">
              <span>Summary</span>
              <strong className="is-body">{item.summary}</strong>
            </div>
          </div>

          {flash ? (
            <p className="mw-admin-flash" role="status" data-testid="drawer-flash">
              <Check size={14} /> {flash}
            </p>
          ) : null}
          {error ? (
            <p className="mw-admin-error" role="alert" data-testid="drawer-error">
              {error}
            </p>
          ) : null}
          {!mayEdit ? (
            <p className="mw-admin-readonly" data-testid="drawer-readonly">
              <Lock size={14} /> {ROLE_LABEL[actor.role]} access — you can read this case but not
              change it.
            </p>
          ) : null}

          <section className="mw-admin-drawersection">
            <h3>
              <ClipboardList size={15} /> Update status
            </h3>
            <div className="mw-admin-inline">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as CaseStatus)}
                aria-label="Case status"
                disabled={!mayEdit}
                data-testid="drawer-status"
              >
                {CASE_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveStatus}
                disabled={!mayEdit || status === item.status}
                data-testid="save-status"
              >
                Save status
              </button>
            </div>
          </section>

          <section className="mw-admin-drawersection">
            <h3>
              <UserPlus size={15} /> Assign to employee
            </h3>
            {mayAssign ? (
              <>
                <div className="mw-admin-inline">
                  <select
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    aria-label="Assigned employee"
                    data-testid="drawer-assignee"
                  >
                    <option value="">Unassigned</option>
                    {canTakeWork.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.id} · {employee.department}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={saveAssignee}
                    disabled={(item.assignedTo ?? "") === assignee}
                    data-testid="save-assignee"
                  >
                    Assign
                  </button>
                </div>
                <p className="mw-admin-hint">
                  Only {item.type} desk employees can take this case, so the list is filtered to
                  them.
                </p>
              </>
            ) : (
              <p className="mw-admin-hint" data-testid="assign-locked">
                <Lock size={13} /> Your role cannot reassign work.
              </p>
            )}
          </section>

          <section className="mw-admin-drawersection">
            <h3>
              <MessageSquarePlus size={15} /> Internal notes
            </h3>
            <ul className="mw-admin-notes" data-testid="drawer-notes">
              {item.notes.length === 0 ? (
                <li className="is-empty">
                  No notes yet. Notes are internal — the customer never sees them.
                </li>
              ) : (
                item.notes.map((entry) => (
                  <li key={entry.id}>
                    <p>{entry.text}</p>
                    <small>
                      {entry.by} · {relativeTime(entry.at)}
                    </small>
                  </li>
                ))
              )}
            </ul>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={mayEdit ? "Add context for the team…" : "Your role cannot add notes."}
              aria-label="New note"
              disabled={!mayEdit}
              data-testid="note-input"
            />
            <button
              type="button"
              className="mw-admin-secondary"
              onClick={saveNote}
              disabled={!mayEdit || note.trim().length < 2}
              data-testid="save-note"
            >
              <MessageSquarePlus size={15} /> Add note
            </button>
          </section>

          <section className="mw-admin-drawersection">
            <h3>History</h3>
            <ol className="mw-admin-timeline">
              {[...item.events].reverse().map((event) => (
                <li key={event.id}>
                  <span>
                    <strong>{event.label}</strong>
                    <small>
                      {event.by} · {relativeTime(event.at)}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
