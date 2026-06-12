import type { RequestHandler } from "@sveltejs/kit";
import { getUserCalendarRoute } from "@/lib/api/routes/calendars";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Generate calendar ICS for a user's subscribed sections and personal deadlines.
 * @pathParams userCalendarPathParamsSchema
 * @response 200:binary
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getUserCalendarRoute(request, { userId: params.userId }),
  )(request);
