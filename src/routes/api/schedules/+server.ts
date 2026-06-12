import { getSchedulesRoute } from "@/lib/api/routes/academic";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List schedules with filters and pagination.
 * @params schedulesQuerySchema
 * @response paginatedScheduleResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getSchedulesRoute));
