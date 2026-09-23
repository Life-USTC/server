import type { RequestHandler } from "@sveltejs/kit";
import { deleteCommentRoute } from "@/lib/api/routes/comments-delete-route";
import { getCommentRoute } from "@/lib/api/routes/comments-thread-route";
import { patchCommentRoute } from "@/lib/api/routes/comments-update-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get comment thread.
 * @pathParams resourceIdPathParamsSchema
 * @response commentThreadResponseSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCommentRoute(request, { id: params.id }))(request);

/**
 * Update one comment.
 * @pathParams resourceIdPathParamsSchema
 * @body commentUpdateRequestSchema
 * @response commentUpdateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchCommentRoute(request, { id: params.id }))(
    request,
  );

/**
 * Delete one comment.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteCommentRoute(request, { id: params.id }))(
    request,
  );
