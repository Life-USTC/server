import { redirect } from "@sveltejs/kit";
import {
  dashboardRedirectHrefFromHome,
  homeTabCompatibilityRedirectHref,
} from "@/features/dashboard/lib/dashboard-nav";
import { loadAnonymousHomePage } from "@/features/dashboard/server/anonymous-home-page-load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const signedIn = Boolean(event.locals.authUser?.id);
  const compatibilityHref = homeTabCompatibilityRedirectHref(
    event.url,
    signedIn,
  );
  if (compatibilityHref) {
    throw redirect(308, compatibilityHref);
  }

  if (event.locals.authUser?.id) {
    throw redirect(303, dashboardRedirectHrefFromHome(event.url));
  }

  return loadAnonymousHomePage({
    locals: event.locals,
    request: event.request,
    url: event.url,
  });
};
