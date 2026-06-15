import { postDashboardLinkPinRoute } from "@/lib/api/routes/dashboard-links";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Pin dashboard link.
 * @body dashboardLinkPinRequestSchema
 * @response 303
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkPinRoute),
);
