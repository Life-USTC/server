import type { RequestHandler } from "@sveltejs/kit";
import { getCommentRepliesRoute } from "@/lib/api/routes/comments-replies-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Continue a bounded reply preview for one comment root.
 * @pathParams resourceIdPathParamsSchema
 * @params commentRepliesQuerySchema
 * @response commentRepliesResponseSchema
 * @response 400:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCommentRepliesRoute(request, { id: params.id }))(
    request,
  );
