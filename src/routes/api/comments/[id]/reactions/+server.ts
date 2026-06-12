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
 */
export const DELETE: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    deleteCommentReactionRoute(request, { id: params.id }),
  )(request);
