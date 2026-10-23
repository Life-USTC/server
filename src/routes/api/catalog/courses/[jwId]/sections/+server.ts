import { getCourseSectionHistoryRoute } from "@/lib/api/routes/academic-section-history-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get complete course section history, including retired offerings.
 * @pathParams jwIdPathParamsSchema
 * @params catalogSectionHistoryQuerySchema
 * @response paginatedSectionHistoryResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getCourseSectionHistoryRoute(request, { jwId: params.jwId }),
  )(request);
