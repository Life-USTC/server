import { getMyCompactOverviewRoute } from "@/lib/api/routes/workspace-overview-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get a compact current-user overview for lightweight clients.
 * @params compactOverviewQuerySchema
 * @response compactOverviewResponseSchema
 * @response 401:openApiErrorSchema
 * @response 400:openApiErrorSchema
 * @oauthScope workspace.overview:read
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getMyCompactOverviewRoute),
);
