import { getTodosRoute, postTodoRoute } from "@/lib/api/routes/todos";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List todos for the current user.
 * @params todosQuerySchema
 * @response todosListResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getTodosRoute));
/**
 * Create a todo for the current user.
 * @body todoCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postTodoRoute));
