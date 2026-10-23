import { getCommentRepliesRoute } from "@/lib/api/routes/comments-replies-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Continue a bounded reply preview for one comment root.
 * @pathParams resourceIdPathParamsSchema
 * @params commentRepliesQuerySchema
 * @response commentRepliesResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @anonymous
 * @oauthScope community.comment:read
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCommentRepliesRoute(request, { id: params.id }))(
    request,
  );
