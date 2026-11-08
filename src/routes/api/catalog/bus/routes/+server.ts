import { getBusRoutesSearchRoute } from "@/lib/api/routes/bus";
import { getDemoBusRoutesRoute } from "@/lib/api/routes/demo-campus-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(
  observedApiRoute(getBusRoutesSearchRoute),
);

/**
 * Search shuttle bus route variants.
 * @params busRouteSearchQuerySchema
 * @response busRouteSearchResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoBusRoutesRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
