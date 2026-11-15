import { createFileRoute } from "@tanstack/react-router";
import { JobVacanciesPanel } from "@/components/admin/JobVacancies";
import { useAdminSession } from "@/lib/admin-auth";

export const Route = createFileRoute("/master-admin/job-vacancies")({
  head: () => ({
    meta: [
      { title: "Job Vacancies | Motor Wallah Master Control" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JobVacanciesRoute,
});

function JobVacanciesRoute() {
  const { session } = useAdminSession();
  if (!session) return null;
  return <JobVacanciesPanel session={session} />;
}
