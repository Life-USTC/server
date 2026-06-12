import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

export const load: PageServerLoad = async (event) => {
  const url = new URL(event.url);
  url.searchParams.set("tab", "subscriptions");

  return loadDashboard({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
