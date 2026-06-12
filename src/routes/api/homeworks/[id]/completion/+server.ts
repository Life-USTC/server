import type { RequestHandler } from "@sveltejs/kit";
import { putHomeworkCompletionRoute } from "@/lib/api/routes/homework-completion";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update completion state for one homework.
 * @pathParams resourceIdPathParamsSchema
 * @body homeworkCompletionRequestSchema
 * @response homeworkCompletionResponseSchema
 * @response 400:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    putHomeworkCompletionRoute(request, { id: params.id }),
  )(request);
