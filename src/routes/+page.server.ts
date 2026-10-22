import { redirect } from "@sveltejs/kit";
import { homeTabCompatibilityRedirectHref } from "@/features/workspace/lib/workspace-nav";
import { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import type { PageServerLoad } from "./$types";

/**
 * `/` is the one home for every visitor, signed in or not.
 *
 * This load is deliberately viewer-independent: it never reads
 * `locals.authUser`, so `/` can live in `STATIC_PUBLIC_PATHS` and be served
 * from the shared public HTML cache. The viewer's own overview is hydrated on
 * the client from `/api/workspace/overview`, and the shell resolves viewer
 * identity on the client because `isViewerIndependentPublicPath("/")` is now
 * true. A signed-in landing is a cached shell plus one async fetch rather than
 * the full workspace SSR it used to redirect into.
 *
 * The `?tab=` compatibility redirect stays. It is viewer-independent, and a
 * request carrying a query string is never admitted to the cache, so it still
 * reaches this load.
 */
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
