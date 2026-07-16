import { postDashboardLinkPinBatchRoute } from "@/lib/api/routes/dashboard-links";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Pin or unpin multiple dashboard links in one request.
 * @body dashboardLinkPinBatchRequestSchema
 * @response dashboardLinkPinResponseSchema
 * @response 400:dashboardLinkPinResponseSchema
 * @response 401:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 * @response 500:dashboardLinkPinResponseSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkPinBatchRoute),
);
