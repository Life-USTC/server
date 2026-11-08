import { getBusNextDeparturesRoute } from "@/lib/api/routes/bus";
import { getDemoBusNextRoute } from "@/lib/api/routes/demo-campus-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(
  observedApiRoute(getBusNextDeparturesRoute),
);

/**
 * Get next shuttle bus departures for an origin and destination campus.
 * @params busNextDeparturesQuerySchema
 * @response busNextDeparturesResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoBusNextRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
