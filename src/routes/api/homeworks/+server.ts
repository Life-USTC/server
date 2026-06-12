import {
  getHomeworksRoute,
  postHomeworkRoute,
} from "@/lib/api/routes/homeworks";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List homeworks by section.
 * @params homeworksQuerySchema
 * @response homeworksListResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getHomeworksRoute));
/**
 * Create one homework.
 * @body homeworkCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postHomeworkRoute));
