import { redirect } from "@sveltejs/kit";
import { homeTabCompatibilityRedirectHref } from "@/features/workspace/lib/workspace-nav";
import { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import type { PageServerLoad } from "./$types";

/** Public content is viewer-independent; the client loads personal data separately. */
export const load: PageServerLoad = async (event) => {
  const compatibilityHref = homeTabCompatibilityRedirectHref(event.url);
  if (compatibilityHref) {
    throw redirect(308, compatibilityHref);
  }

  return loadHomePage({
    locals: event.locals,
    request: event.request,
    url: event.url,
  });
};
