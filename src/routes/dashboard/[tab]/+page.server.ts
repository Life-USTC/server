import { error } from "@sveltejs/kit";
import { dashboardPageActions } from "@/features/dashboard/server/dashboard-page-actions";
import { loadDashboardPage } from "@/features/dashboard/server/dashboard-page-load";
import type { Actions, PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboardPage>[0];

const DASHBOARD_TABS = new Set([
  "overview",
  "calendar",
  "bus",
  "links",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
]);
export const load: PageServerLoad = async (event) => {
  if (!DASHBOARD_TABS.has(event.params.tab)) {
    error(404, "Dashboard page not found");
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);

  return loadDashboardPage({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions: Actions = dashboardPageActions;
