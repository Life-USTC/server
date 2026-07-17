import type { RequestHandler } from "@sveltejs/kit";
import { getSectionSchedulesRoute } from "@/lib/api/routes/academic-section-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get section schedules.
 * @pathParams jwIdPathParamsSchema
 * @params sectionSchedulesQuerySchema
 * @response 200:array
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getSectionSchedulesRoute(request, { jwId: params.jwId }),
  )(request);
