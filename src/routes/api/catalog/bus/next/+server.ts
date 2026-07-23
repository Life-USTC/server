import { getBusNextDeparturesRoute } from "@/lib/api/routes/bus";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get next shuttle bus departures for an origin and destination campus.
 * @params busNextDeparturesQuerySchema
 * @response busNextDeparturesResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getBusNextDeparturesRoute),
);
