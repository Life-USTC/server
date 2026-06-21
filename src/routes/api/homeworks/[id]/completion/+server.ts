import type { RequestHandler } from "@sveltejs/kit";
import { putHomeworkCompletionRoute } from "@/lib/api/routes/homework-completion";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update homework completion.
 * @pathParams resourceIdPathParamsSchema
 * @body homeworkCompletionRequestSchema
 * @response homeworkCompletionResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    putHomeworkCompletionRoute(request, { id: params.id }),
  )(request);
