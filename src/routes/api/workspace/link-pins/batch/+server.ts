import { postDashboardLinkPinBatchRoute } from "@/lib/api/routes/dashboard-link-pin-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Set multiple campus link pins.
 * @body workspaceLinkPinBatchRequestSchema
 * @response workspaceLinkPinResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 500:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkPinBatchRoute),
);
