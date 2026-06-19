import { putHomeworkCompletionsRoute } from "@/lib/api/routes/homework-completion";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update homework completions in a batch.
 * @body homeworkCompletionBatchRequestSchema
 * @response homeworkCompletionBatchResponseSchema
 * @response 400:openApiErrorSchema
 */
export const PUT = svelteRequestHandler(
  observedApiRoute(putHomeworkCompletionsRoute),
);
