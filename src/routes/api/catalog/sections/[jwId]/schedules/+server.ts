import { getSectionSchedulesRoute } from "@/lib/api/routes/academic-section-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get section schedules.
 * @pathParams jwIdPathParamsSchema
 * @params sectionSchedulesQuerySchema
 * @response 200:sectionSchedulesReadResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getSectionSchedulesRoute(request, { jwId: params.jwId }),
  )(request);
