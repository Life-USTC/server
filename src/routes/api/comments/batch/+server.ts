import { deleteCommentBatchRoute } from "@/lib/api/routes/comment-batch-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Delete multiple comments owned by the current user.
 * @body commentBatchDeleteRequestSchema
 * @response commentBatchDeleteResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 */
export const DELETE = svelteRequestHandler(
  observedApiRoute(deleteCommentBatchRoute),
);
