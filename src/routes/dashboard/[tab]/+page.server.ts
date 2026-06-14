import { error } from "@sveltejs/kit";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

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

  return loadDashboard({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
