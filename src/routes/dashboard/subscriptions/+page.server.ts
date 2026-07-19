import { redirect } from "@sveltejs/kit";
import { dashboardPageActions } from "@/features/dashboard/server/dashboard-page-actions";
import { loadSignedDashboardPage } from "@/features/dashboard/server/dashboard-page-load";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.authUser?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  const url = new URL(event.url);
  url.searchParams.set("tab", "subscriptions");

  return loadSignedDashboardPage({
    locals: event.locals,
    request: event.request,
    url,
    userId: event.locals.authUser.id,
  });
};

export const actions: Actions = dashboardPageActions;
