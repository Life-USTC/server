import type { RequestHandler } from "@sveltejs/kit";
import { getCourseDetailRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get course.
 * @pathParams jwIdPathParamsSchema
 * @response courseDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCourseDetailRoute(request, { jwId: params.jwId }))(
    request,
  );
