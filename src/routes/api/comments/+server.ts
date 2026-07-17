import { postCommentRoute } from "@/lib/api/routes/comments-create-route";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
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
 * @response 201:idResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(observedApiRoute(postCommentRoute));
