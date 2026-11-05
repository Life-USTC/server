import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { getDemoCourseListRoute } from "@/lib/api/routes/demo-course-list-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List courses.
 * @params coursesQuerySchema
 * @response paginatedCourseResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, locals }) =>
  locals.demo
    ? getDemoCourseListRoute(request, locals.locale)
    : observedApiRoute(getCoursesRoute)(request);
