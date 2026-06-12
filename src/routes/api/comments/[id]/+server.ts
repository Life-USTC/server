import type { RequestHandler } from "@sveltejs/kit";
import {
  deleteCommentRoute,
  getCommentRoute,
  patchCommentRoute,
} from "@/lib/api/routes/comments";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get one comment thread by comment ID.
 * @pathParams resourceIdPathParamsSchema
 * @response commentThreadResponseSchema
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
 */
export const PATCH: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => patchCommentRoute(request, { id: params.id }))(
    request,
  );

/**
 * Delete one comment.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => deleteCommentRoute(request, { id: params.id }))(
    request,
  );
