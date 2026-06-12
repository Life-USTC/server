import { error, redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../../+page.server";
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
const PUBLIC_DASHBOARD_TABS = new Set(["bus", "links"]);

export const load: PageServerLoad = async (event) => {
  if (!DASHBOARD_TABS.has(event.params.tab)) {
    error(404, "Dashboard page not found");
  }
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session?.user?.id && !PUBLIC_DASHBOARD_TABS.has(event.params.tab)) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", event.params.tab);

  return loadDashboard({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
