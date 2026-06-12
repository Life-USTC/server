import type { RequestHandler } from "@sveltejs/kit";
import { getCourseDetailRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get course detail by JW ID.
 * @pathParams jwIdPathParamsSchema
 * @response courseDetailSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCourseDetailRoute({ jwId: params.jwId }))(request);
