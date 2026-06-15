import type { RequestHandler } from "@sveltejs/kit";
import { getSectionCalendarRoute } from "@/lib/api/routes/calendars";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Generate section calendar.
 * @pathParams jwIdPathParamsSchema
 * @response 200:binary
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionCalendarRoute({ jwId: params.jwId }))(
    request,
  );
