import { postCommentRoute } from "@/lib/api/routes/comments-create-route";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { getDemoCommentsRoute } from "@/lib/api/routes/demo-catalog-read-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List comments.
 * @params commentsQuerySchema
 * @response commentsListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @anonymous
 * @oauthScope community.comment:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoCommentsRoute(event.request, event.locals.locale)
    : svelteRequestHandler(observedApiRoute(getCommentsRoute))(event);
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
 * @oauthScope community.comment:write
 */
export const POST = svelteRequestHandler(observedApiRoute(postCommentRoute));
