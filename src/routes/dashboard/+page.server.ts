import { redirect } from "@sveltejs/kit";
import { dashboardTabCompatibilityRedirectHref } from "@/features/dashboard/lib/dashboard-nav";
import { dashboardPageActions } from "@/features/dashboard/server/dashboard-page-actions";
import { loadSignedDashboardPage } from "@/features/dashboard/server/dashboard-page-load";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const compatibilityHref = dashboardTabCompatibilityRedirectHref(event.url);
  if (compatibilityHref) {
    throw redirect(308, compatibilityHref);
  }

  if (!event.locals.authUser?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(`${event.url.pathname}${event.url.search}`),
    );
  }

  return loadSignedDashboardPage({
    locals: event.locals,
    request: event.request,
    url: event.url,
    userId: event.locals.authUser.id,
  });
};

export const actions: Actions = dashboardPageActions;
