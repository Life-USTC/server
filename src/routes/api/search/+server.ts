import {
  getDemoGlobalSearchRoute,
  getGlobalSearchRoute,
} from "@/lib/api/routes/global-search";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Global search across catalog and workspace entities.
 * @params q, limit, locale, scope
 * @response globalSearchResponse
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoGlobalSearchRoute(event.request)
    : svelteRequestHandler(observedApiRoute(getGlobalSearchRoute))(event);
