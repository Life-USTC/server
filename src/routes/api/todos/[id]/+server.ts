import type { RequestHandler } from "@sveltejs/kit";
import { deleteTodoRoute, patchTodoRoute } from "@/lib/api/routes/todos";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update one todo.
 * @pathParams resourceIdPathParamsSchema
 * @body todoUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchTodoRoute(request, { id: params.id }))(request);

/**
 * Delete one todo.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteTodoRoute(request, { id: params.id }))(request);
