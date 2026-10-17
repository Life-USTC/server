import { getCourseDetailRoute } from "@/lib/api/routes/academic-course-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get course.
 * @pathParams jwIdPathParamsSchema
 * @params catalogLocaleQuerySchema
 * @response courseDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCourseDetailRoute(request, { jwId: params.jwId }))(
    request,
  );
