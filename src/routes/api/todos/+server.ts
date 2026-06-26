import { getTodosRoute, postTodoRoute } from "@/lib/api/routes/todos";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List todos.
 * @params todosQuerySchema
 * @response todosListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getTodosRoute));
/**
 * Create a todo.
 * @body todoCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postTodoRoute));
