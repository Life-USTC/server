import { getTeacherSectionHistoryRoute } from "@/lib/api/routes/academic-section-history-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get complete teacher section history, including retired offerings.
 * @pathParams resourceIdPathParamsSchema
 * @params catalogSectionHistoryQuerySchema
 * @response paginatedSectionHistoryResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getTeacherSectionHistoryRoute(request, { id: params.id }),
  )(request);
