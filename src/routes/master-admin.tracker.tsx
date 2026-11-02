import { createFileRoute } from "@tanstack/react-router";
import { MasterTracker, type TaskScope } from "@/components/admin/MasterTracker";
import { useAdminSession } from "@/lib/admin-auth";

type TrackerSearch = { case?: string | undefined; scope?: TaskScope | undefined };

export const Route = createFileRoute("/master-admin/tracker")({
  validateSearch: (search: Record<string, unknown>): TrackerSearch => ({
    case: typeof search["case"] === "string" && search["case"].trim() ? search["case"] : undefined,
    scope: search["scope"] === "my" || search["scope"] === "all" ? search["scope"] : undefined,
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
      search: { case: id ?? undefined, scope: search.scope },
      replace: true,
    });
  };

  const setScope = (scope: TaskScope) => {
    void navigate({
      to: "/master-admin/tracker",
      search: { case: search.case, scope },
      replace: true,
    });
  };

  if (!session) return null;

  return (
    <MasterTracker
      session={session}
      caseId={search.case ?? null}
      scope={search.scope ?? (session.role === "executive" ? "my" : "all")}
      onScopeChange={setScope}
      onCaseChange={setCase}
    />
  );
}
