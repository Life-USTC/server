import { getCommentsRoute, postCommentRoute } from "@/lib/api/routes/comments";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List comments.
 * @params commentsQuerySchema
 * @response commentsListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getCommentsRoute));
/**
 * Create one comment.
 * @body commentCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postCommentRoute));
