import type { RequestHandler } from "@sveltejs/kit";
import {
  deleteHomeworkRoute,
  patchHomeworkRoute,
} from "@/lib/api/routes/homeworks";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Update one homework.
 * @pathParams resourceIdPathParamsSchema
 * @body homeworkUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchHomeworkRoute(request, { id: params.id }))(
    request,
  );

/**
 * Soft delete one homework.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteHomeworkRoute(request, { id: params.id }))(
    request,
  );
