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
 * @response homeworkUpdateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchHomeworkRoute(request, { id: params.id }))(
    request,
  );

/**
 * Soft delete one homework.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteHomeworkRoute(request, { id: params.id }))(
    request,
  );
