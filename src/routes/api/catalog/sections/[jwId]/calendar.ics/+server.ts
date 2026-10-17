import { getSectionCalendarRoute } from "@/lib/api/routes/calendars";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Generate section calendar.
 * @pathParams jwIdPathParamsSchema
 * @response 200:calendar
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionCalendarRoute({ jwId: params.jwId }))(
    request,
  );
