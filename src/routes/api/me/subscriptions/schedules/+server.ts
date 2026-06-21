import { getMySubscribedSchedulesRoute } from "@/lib/api/routes/subscribed-schedule-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List schedules across the current user's subscribed sections.
 * @params subscribedSchedulesQuerySchema
 * @response subscribedSchedulesResponseSchema
 * @response 401:openApiErrorSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getMySubscribedSchedulesRoute),
);
