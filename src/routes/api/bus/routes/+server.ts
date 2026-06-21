import { getBusRoutesSearchRoute } from "@/lib/api/routes/bus";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Search shuttle bus route variants.
 * @params busRouteSearchQuerySchema
 * @response busRouteSearchResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getBusRoutesSearchRoute),
);
