import type { RequestHandler } from "@sveltejs/kit";
import { getSectionScheduleGroupsRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get schedule groups for one section.
 * @pathParams jwIdPathParamsSchema
 * @response 200:array
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionScheduleGroupsRoute({ jwId: params.jwId }))(
    request,
  );
