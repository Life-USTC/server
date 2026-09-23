import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List courses.
 * @params coursesQuerySchema
 * @response paginatedCourseResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getCoursesRoute));
