import { getActionableOverviewRoute } from "@/lib/api/routes/workspace-actionable-overview-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get the complete current-user action hierarchy and pending deadlines.
 * @params actionableOverviewQuerySchema
 * @response actionableOverviewResponseSchema
 * @response 401:openApiErrorSchema
 * @response 400:openApiErrorSchema
 * @oauthScope workspace.overview:read
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getActionableOverviewRoute),
);
