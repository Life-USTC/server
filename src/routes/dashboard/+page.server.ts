import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import {
  actions as dashboardActions,
  load as loadDashboard,
} from "../+page.server";
import type { PageServerLoad } from "./$types";

type DashboardLoadEvent = Parameters<typeof loadDashboard>[0];

export const load: PageServerLoad = async (event) => {
  const session = hasRequestAuthSignal(event.request.headers)
    ? await import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
        getSessionFromHeaders(event.request.headers),
      )
    : null;
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  return loadDashboard(event as unknown as DashboardLoadEvent);
};

export const actions = dashboardActions;
