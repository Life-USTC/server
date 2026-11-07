import { getTeachersRoute } from "@/lib/api/routes/academic-teacher-routes";
import { getDemoTeacherListRoute } from "@/lib/api/routes/demo-teacher-list-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List teachers.
 * @params teachersQuerySchema
 * @response paginatedTeacherResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, locals }) =>
  locals.demo
    ? getDemoTeacherListRoute(request, locals.locale)
    : observedApiRoute(getTeachersRoute)(request);
