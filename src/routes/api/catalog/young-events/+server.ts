import { getDemoYoungEventsRoute } from "@/lib/api/routes/demo-young-route";
import { getYoungEventsRoute } from "@/lib/api/routes/young-event-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(observedApiRoute(getYoungEventsRoute));

/**
 * List second-classroom (Young) signup events.
 * @params youngEventsQuerySchema
 * @response paginatedYoungEventResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoYoungEventsRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
