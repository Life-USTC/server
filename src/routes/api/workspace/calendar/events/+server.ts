import { getDemoCalendarRoute } from "@/lib/api/routes/demo-calendar-route";
import { getPersonalCalendarRoute } from "@/lib/api/routes/young-workspace-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";
/**
 * List complete personal calendar events by date range, with explicit pagination.
 * @params personalCalendarQuerySchema
 * @response personalCalendarPageSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.calendar:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoCalendarRoute(event.request, event.locals.locale)
    : svelteRequestHandler(observedApiRoute(getPersonalCalendarRoute))(event);
