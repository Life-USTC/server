import { getPersonalCalendarRoute } from "@/lib/api/routes/young-workspace-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * List complete personal calendar events by date range, with explicit pagination.
 * @params personalCalendarQuerySchema
 * @response personalCalendarPageSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getPersonalCalendarRoute),
);
