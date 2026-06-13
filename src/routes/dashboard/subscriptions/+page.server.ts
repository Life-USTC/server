import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

export const load: PageServerLoad = async (event) => {
  if (!event.locals.authUser?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", "subscriptions");

  return loadDashboard({ ...event, url } as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
