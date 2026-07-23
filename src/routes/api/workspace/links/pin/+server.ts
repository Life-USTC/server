import { postDashboardLinkPinRoute } from "@/lib/api/routes/dashboard-link-pin-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Pin dashboard link.
 * @body dashboardLinkPinRequestSchema
 * @response dashboardLinkPinResponseSchema
 * @response 303
 * @response 400:dashboardLinkPinResponseSchema
 * @response 401:dashboardLinkPinResponseSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 * @response 500:dashboardLinkPinResponseSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkPinRoute),
);
