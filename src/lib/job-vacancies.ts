import { describeSupabaseError, supabaseClient } from "@/lib/supabase";
import { staffClient, staffSession } from "@/lib/staff-auth";

/**
 * Job vacancies for the public careers page.
 *
 * The control room owns the rows (`job_vacancies` in
 * supabase/admin-features.sql). Visitors read Active rows with the anon key;
 * staff read and write every row through their Supabase session, so a vacancy
 * added on one device appears on the careers page everywhere.
 */

export type JobVacancy = {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  employmentType: string;
  status: "Active" | "Closed";
  createdAt: string;
};

export const JOB_VACANCIES_SETUP_HINT =
  "The job_vacancies table is not in this database yet. Run supabase/admin-features.sql in the Supabase SQL editor, then reload this page.";

const COLUMNS = "id, title, department, location, description, employment_type, status, created_at";

type Row = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  description: string | null;
  employment_type: string | null;
  status: string | null;
  created_at: string;
};

const rowToVacancy = (row: Row): JobVacancy => ({
  id: row.id,
  title: row.title,
  department: row.department ?? "",
  location: row.location ?? "",
  description: row.description ?? "",
  employmentType: row.employment_type ?? "Full-time",
  status: row.status === "Closed" ? "Closed" : "Active",
  createdAt: row.created_at,
});

const isMissingTable = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) &&
  (error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/i.test(error?.message ?? ""));

export type VacancyInput = {
  title: string;
  department: string;
  location: string;
  description: string;
  employmentType: string;
  status: "Active" | "Closed";
};

/** Public: only the roles that are still open. */
export async function loadOpenVacancies(): Promise<{
  vacancies: JobVacancy[];
  missing: boolean;
  error: string | null;
}> {
  const client = supabaseClient();
  if (!client) return { vacancies: [], missing: false, error: "The database is not configured." };

  const { data, error } = await client
    .from("job_vacancies")
    .select(COLUMNS)
    .eq("status", "Active")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      vacancies: [],
      missing: isMissingTable(error),
      error: isMissingTable(error) ? JOB_VACANCIES_SETUP_HINT : describeSupabaseError(error),
    };
  }
  return { vacancies: ((data ?? []) as Row[]).map(rowToVacancy), missing: false, error: null };
}

/** Staff: every vacancy, including closed ones. */
export async function loadAllVacancies(): Promise<{
  vacancies: JobVacancy[];
  missing: boolean;
  error: string | null;
}> {
  const client = staffClient();
  if (!client) return { vacancies: [], missing: false, error: "The database is not configured." };
  await staffSession();

  const { data, error } = await client
    .from("job_vacancies")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      vacancies: [],
      missing: isMissingTable(error),
      error: isMissingTable(error) ? JOB_VACANCIES_SETUP_HINT : describeSupabaseError(error),
    };
  }
  return { vacancies: ((data ?? []) as Row[]).map(rowToVacancy), missing: false, error: null };
}

export async function createVacancy(
  input: VacancyInput,
): Promise<{ ok: boolean; error?: string; vacancy?: JobVacancy }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { data, error } = await client
    .from("job_vacancies")
    .insert({
      title: input.title.trim(),
      department: input.department.trim(),
      location: input.location.trim(),
      description: input.description.trim(),
      employment_type: input.employmentType.trim() || "Full-time",
      status: input.status,
    })
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    return { ok: false, error: describeSupabaseError(error) };
  }
  return data
    ? { ok: true, vacancy: rowToVacancy(data as Row) }
    : { ok: false, error: "The vacancy was saved but could not be read back." };
}

export async function updateVacancy(
  id: string,
  input: VacancyInput,
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client
    .from("job_vacancies")
    .update({
      title: input.title.trim(),
      department: input.department.trim(),
      location: input.location.trim(),
      description: input.description.trim(),
      employment_type: input.employmentType.trim() || "Full-time",
      status: input.status,
    })
    .eq("id", id);

  return error ? { ok: false, error: describeSupabaseError(error) } : { ok: true };
}

export async function deleteVacancy(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client.from("job_vacancies").delete().eq("id", id);
  return error ? { ok: false, error: describeSupabaseError(error) } : { ok: true };
}
