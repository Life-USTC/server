import type { RequestHandler } from "@sveltejs/kit";
import {
  deleteCommentReactionRoute,
  postCommentReactionRoute,
} from "@/lib/api/routes/comment-reactions";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Add one reaction to a comment.
 * @pathParams resourceIdPathParamsSchema
 * @body commentReactionRequestSchema
 * @response 200:successResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => postCommentReactionRoute(request, { id: params.id }))(
    request,
  );

/**
 * Remove one reaction from a comment.
 * @pathParams resourceIdPathParamsSchema
 * @params commentReactionRequestSchema
 * @response 200:successResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    deleteCommentReactionRoute(request, { id: params.id }),
  )(request);
