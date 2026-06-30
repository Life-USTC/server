import {
  deleteTodoBatchRoute,
  patchTodoBatchRoute,
} from "@/lib/api/routes/todo-batch-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update completion state for multiple todos.
 * @body todoCompletionBatchRequestSchema
 * @response todoCompletionBatchResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const PATCH = svelteRequestHandler(observedApiRoute(patchTodoBatchRoute));

/**
 * Delete multiple todos by id.
 * @body todoBatchDeleteRequestSchema
 * @response todoBatchDeleteResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const DELETE = svelteRequestHandler(observedApiRoute(deleteTodoBatchRoute));
