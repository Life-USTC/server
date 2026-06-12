import { getTeachersRoute } from "@/lib/api/routes/academic";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List teachers with department/search filters.
 * @params teachersQuerySchema
 * @response paginatedTeacherResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getTeachersRoute));
