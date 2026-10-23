import {
  getDemoTodosRoute,
  getTodosRoute,
  postTodoRoute,
} from "@/lib/api/routes/todos";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List todos.
 * @params todosQuerySchema
 * @response todosListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.todo:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoTodosRoute(event.request, event.locals.locale)
    : svelteRequestHandler(observedApiRoute(getTodosRoute))(event);
/**
 * Create a todo.
 * @body todoCreateRequestSchema
 * @response 201:idResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 * @oauthScope workspace.todo:write
 */
export const POST = svelteRequestHandler(observedApiRoute(postTodoRoute));
