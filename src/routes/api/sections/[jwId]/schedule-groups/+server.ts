import type { RequestHandler } from "@sveltejs/kit";
import { getSectionScheduleGroupsRoute } from "@/lib/api/routes/academic-section-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get schedule groups.
 * @pathParams jwIdPathParamsSchema
 * @response 200:array
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getSectionScheduleGroupsRoute(request, { jwId: params.jwId }),
  )(request);
