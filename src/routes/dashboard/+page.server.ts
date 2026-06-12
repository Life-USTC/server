import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

export const load: PageServerLoad = async (event) => {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  return loadDashboard(event as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
