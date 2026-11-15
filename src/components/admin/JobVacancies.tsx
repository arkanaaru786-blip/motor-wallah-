import { useCallback, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type { AdminSession } from "@/lib/admin-auth";
import { actorFromSession, isSuperAdmin } from "@/lib/admin-rbac";
import {
  JOB_VACANCIES_SETUP_HINT,
  createVacancy,
  deleteVacancy,
  loadAllVacancies,
  updateVacancy,
  type JobVacancy,
  type VacancyInput,
} from "@/lib/job-vacancies";

const EMPTY: VacancyInput = {
  title: "",
  department: "",
  location: "Indore",
  description: "",
  employmentType: "Full-time",
  status: "Active",
};

/**
 * Job Vacancies — the roles shown on the public /careers page.
 *
 * Adding, editing or closing a role here changes the live page: the careers
 * route reads the same `job_vacancies` table.
 */
export function JobVacanciesPanel({ session }: { session: AdminSession }) {
  const allowed = isSuperAdmin(actorFromSession(session));

  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [form, setForm] = useState<VacancyInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await loadAllVacancies();
    setVacancies(result.vacancies);
    setMissing(result.missing);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <section className="mw-admin-panel" data-testid="jobs-locked">
        <header className="mw-admin-panel-head">
          <div>
            <p className="mw-admin-eyebrow">Careers</p>
            <h2>Super admin only</h2>
          </div>
        </header>
        <p className="mw-admin-hint">Only a super admin can change the public careers page.</p>
      </section>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormOpen(true);
    setError(null);
    setFlash(null);
  };

  const openEdit = (vacancy: JobVacancy) => {
    setEditingId(vacancy.id);
    setForm({
      title: vacancy.title,
      department: vacancy.department,
      location: vacancy.location,
      description: vacancy.description,
      employmentType: vacancy.employmentType,
      status: vacancy.status,
    });
    setFormOpen(true);
    setError(null);
    setFlash(null);
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (form.title.trim().length < 2) {
      setError("Enter the job title.");
      return;
    }
    if (form.description.trim().length < 10) {
      setError("Add a short description so candidates know what the role involves.");
      return;
    }

    setBusy(true);
    setError(null);
    const result = editingId ? await updateVacancy(editingId, form) : await createVacancy(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save this vacancy.");
      return;
    }
    setFlash(
      editingId
        ? "Vacancy updated — the careers page is current."
        : "Vacancy published to the careers page.",
    );
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    await load();
  }

  async function remove(vacancy: JobVacancy) {
    if (
      !window.confirm(`Delete "${vacancy.title}"? It disappears from the careers page immediately.`)
    ) {
      return;
    }
    setBusy(true);
    const result = await deleteVacancy(vacancy.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not delete this vacancy.");
      return;
    }
    setFlash(`"${vacancy.title}" removed from the careers page.`);
    await load();
  }

  return (
    <div className="mw-admin-dash" data-testid="job-vacancies-page">
      <div className="mw-dealer-pagehead">
        <div>
          <p className="mw-admin-eyebrow">Careers</p>
          <h2>Job Vacancies</h2>
          <p>Roles published here appear immediately on the public /careers page.</p>
        </div>
        <button
          type="button"
          className="mw-dealer-btn is-primary mw-dealer-add"
          onClick={openCreate}
          data-testid="job-add-new"
        >
          <PlusCircle size={16} /> Add Vacancy
        </button>
      </div>

      {missing ? (
        <p className="mw-admin-error" data-testid="jobs-setup">
          {JOB_VACANCIES_SETUP_HINT}
        </p>
      ) : null}
      {error && !missing ? (
        <p className="mw-admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="mw-admin-flash" role="status">
          <CheckCircle2 size={14} /> {flash}
        </p>
      ) : null}

      {formOpen ? (
        <section className="mw-admin-panel" data-testid="job-form">
          <div className="mw-admin-panel-head">
            <div>
              <h2>
                <BriefcaseBusiness size={15} /> {editingId ? "Edit vacancy" : "New vacancy"}
              </h2>
              <p>
                Title, department, location and description are shown to candidates exactly as
                typed.
              </p>
            </div>
            <button
              type="button"
              className="mw-dealer-btn is-quiet"
              onClick={() => setFormOpen(false)}
            >
              <X size={14} /> Close
            </button>
          </div>
          <form className="mw-dealer-form" onSubmit={save}>
            <label className="mw-dealer-field">
              <span>Job title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Sales Executive"
                required
                data-testid="job-title"
              />
            </label>
            <label className="mw-dealer-field">
              <span>Department</span>
              <input
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                placeholder="Marketplace"
                data-testid="job-department"
              />
            </label>
            <label className="mw-dealer-field">
              <span>Location</span>
              <input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Indore"
                data-testid="job-location"
              />
            </label>
            <label className="mw-dealer-field">
              <span>Employment type</span>
              <select
                value={form.employmentType}
                onChange={(event) => setForm({ ...form, employmentType: event.target.value })}
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
            </label>
            <label className="mw-dealer-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value === "Closed" ? "Closed" : "Active",
                  })
                }
                data-testid="job-status"
              >
                <option value="Active">Active (shown on careers)</option>
                <option value="Closed">Closed (hidden)</option>
              </select>
            </label>
            <label className="mw-dealer-field is-span-3">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="What the role involves and who it suits."
                required
                data-testid="job-description"
              />
            </label>
            <div className="mw-dealer-form-actions">
              <button
                type="submit"
                className="mw-dealer-btn is-primary"
                disabled={busy}
                data-testid="job-save"
              >
                {busy ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}{" "}
                {busy ? "Saving…" : editingId ? "Save Changes" : "Publish Vacancy"}
              </button>
              <button
                type="button"
                className="mw-dealer-btn is-quiet"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mw-admin-panel">
        <div className="mw-admin-panel-head">
          <div>
            <h2>
              <BriefcaseBusiness size={15} /> Open roles
            </h2>
            <p>
              {vacancies.length} vacancies · {vacancies.filter((v) => v.status === "Active").length}{" "}
              live
            </p>
          </div>
          <button
            type="button"
            className="mw-dealer-btn is-small"
            onClick={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            data-testid="jobs-refresh"
          >
            <RefreshCw size={13} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="mw-admin-hint" aria-busy="true">
            <Loader2 size={14} /> Loading vacancies…
          </p>
        ) : vacancies.length === 0 ? (
          <div className="mw-admin-empty" data-testid="jobs-empty">
            <p>
              No vacancies yet. The careers page keeps showing the built-in roles until the first
              one is published.
            </p>
            <button type="button" className="mw-dealer-btn is-primary" onClick={openCreate}>
              <PlusCircle size={15} /> Add Vacancy
            </button>
          </div>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="jobs-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((vacancy) => (
                  <tr key={vacancy.id} data-testid={`job-row-${vacancy.id}`}>
                    <td>
                      <strong>{vacancy.title}</strong>
                      <div className="is-muted">
                        {vacancy.description.slice(0, 90)}
                        {vacancy.description.length > 90 ? "…" : ""}
                      </div>
                    </td>
                    <td>{vacancy.department || "—"}</td>
                    <td>{vacancy.location || "—"}</td>
                    <td>
                      <span
                        className={`mw-dealer-chip ${vacancy.status === "Active" ? "is-active" : "is-closed"}`}
                      >
                        {vacancy.status}
                      </span>
                    </td>
                    <td>
                      <div className="mw-dealer-actions">
                        <button
                          type="button"
                          className="mw-dealer-btn is-small"
                          onClick={() => openEdit(vacancy)}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          className="mw-dealer-btn is-small is-danger"
                          disabled={busy}
                          onClick={() => void remove(vacancy)}
                          data-testid={`job-delete-${vacancy.id}`}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mw-admin-setup-hint">
          First time here? Run <code>supabase/admin-features.sql</code> in the Supabase SQL editor —
          it creates the table the careers page reads.
        </p>
      </section>
    </div>
  );
}
