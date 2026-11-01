import { createFileRoute } from "@tanstack/react-router";
import { MasterTracker } from "@/components/admin/MasterTracker";
import { useAdminSession } from "@/lib/admin-auth";

type TrackerSearch = { case?: string | undefined };

export const Route = createFileRoute("/master-admin/tracker")({
  validateSearch: (search: Record<string, unknown>): TrackerSearch => ({
    case: typeof search["case"] === "string" && search["case"].trim() ? search["case"] : undefined,
  }),
  component: MasterTrackerRoute,
});

function MasterTrackerRoute() {
  const { session } = useAdminSession();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setCase = (id: string | null) => {
    void navigate({
      to: "/master-admin/tracker",
      search: { case: id ?? undefined },
      replace: true,
    });
  };

  return (
    <MasterTracker
      actor={session?.name ?? "Administrator"}
      caseId={search.case ?? null}
      onCaseChange={setCase}
    />
  );
}
