import { getBusRoute } from "@/lib/api/routes/bus";
import { getDemoBusRoute } from "@/lib/api/routes/demo-campus-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(observedApiRoute(getBusRoute));

/**
 * Query shuttle buses.
 * @params busQuerySchema
 * @response busQueryResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoBusRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
