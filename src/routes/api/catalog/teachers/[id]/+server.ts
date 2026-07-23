import type { RequestHandler } from "@sveltejs/kit";
import { getTeacherDetailRoute } from "@/lib/api/routes/academic-teacher-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get teacher.
 * @pathParams teacherIdPathParamsSchema
 * @params catalogLocaleQuerySchema
 * @response teacherDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getTeacherDetailRoute(request, { id: params.id }))(
    request,
  );
