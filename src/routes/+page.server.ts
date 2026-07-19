import { redirect } from "@sveltejs/kit";
import { dashboardRedirectHrefFromHome } from "@/features/dashboard/lib/dashboard-nav";
import { loadAnonymousHomePage } from "@/features/dashboard/server/anonymous-home-page-load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (event.locals.authUser?.id) {
    throw redirect(303, dashboardRedirectHrefFromHome(event.url));
  }

  return loadAnonymousHomePage({
    locals: event.locals,
    request: event.request,
    url: event.url,
  });
};
