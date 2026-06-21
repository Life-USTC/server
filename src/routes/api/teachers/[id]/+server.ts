import type { RequestHandler } from "@sveltejs/kit";
import { getTeacherDetailRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get teacher.
 * @pathParams resourceIdPathParamsSchema
 * @response teacherDetailSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getTeacherDetailRoute(request, { id: params.id }))(
    request,
  );
