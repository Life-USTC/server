import { redirect } from "@sveltejs/kit";
import { homeTabCompatibilityRedirectHref } from "@/features/workspace/lib/workspace-nav";
import { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import { PUBLIC_SSR_DEGRADED_HEADER } from "@/lib/cloudflare/public-ssr-gateway";
import type { PageServerLoad } from "./$types";

/** Public content is viewer-independent; the client loads personal data separately. */
export const load: PageServerLoad = async (event) => {
  const compatibilityHref = homeTabCompatibilityRedirectHref(event.url);
  if (compatibilityHref) {
    throw redirect(308, compatibilityHref);
  }

  const data = await loadHomePage({
    locals: event.locals,
    request: event.request,
    url: event.url,
  });
  if (
    data.information?.notices === null ||
    data.information?.activities === null
  ) {
    event.setHeaders({
      [PUBLIC_SSR_DEGRADED_HEADER]: "1",
      "Cache-Control": "private, no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    });
  }
  return data;
};
