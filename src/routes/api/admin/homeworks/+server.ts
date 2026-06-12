import { getAdminHomeworksRoute } from "@/lib/api/routes/admin";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List moderation homeworks.
 * @params adminHomeworksQuerySchema
 * @response adminHomeworksResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAdminHomeworksRoute),
);
