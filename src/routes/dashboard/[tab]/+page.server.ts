import { error } from "@sveltejs/kit";
import { isSignedDashboardTab } from "@/features/dashboard/lib/dashboard-nav";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

export const load: PageServerLoad = async (event) => {
  if (!isSignedDashboardTab(event.params.tab)) {
    error(404, "Dashboard page not found");
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);

  return loadDashboard({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
