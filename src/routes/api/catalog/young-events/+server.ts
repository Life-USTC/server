import { getYoungEventsRoute } from "@/lib/api/routes/young-event-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List second-classroom (Young) signup events.
 * @params youngEventsQuerySchema
 * @response paginatedYoungEventResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getYoungEventsRoute));
