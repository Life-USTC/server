import { getCatalogLinkVisitRoute } from "@/lib/api/routes/catalog-link-visit-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Resolve a public campus link and record an authenticated visit.
 * @params catalogLinkVisitQuerySchema
 * @response 307
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getCatalogLinkVisitRoute),
);
