import {
  getHomeworksRoute,
  postHomeworkRoute,
} from "@/lib/api/routes/homeworks";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List homeworks.
 * @params homeworksQuerySchema
 * @response homeworksListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getHomeworksRoute));
/**
 * Create one homework.
 * @body homeworkCreateRequestSchema
 * @response 201:homeworkCreateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postHomeworkRoute));
