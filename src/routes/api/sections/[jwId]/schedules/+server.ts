import type { RequestHandler } from "@sveltejs/kit";
import { getSectionSchedulesRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get all schedules for one section.
 * @pathParams jwIdPathParamsSchema
 * @response 200:array
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionSchedulesRoute({ jwId: params.jwId }))(
    request,
  );
