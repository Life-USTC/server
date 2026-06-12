import { getAdminCommentsRoute } from "@/lib/api/routes/admin";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List moderation comments.
 * @params adminCommentsQuerySchema
 * @response adminCommentsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAdminCommentsRoute),
);
