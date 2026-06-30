import { patchTodoBatchRoute } from "@/lib/api/routes/todo-batch-route";
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
