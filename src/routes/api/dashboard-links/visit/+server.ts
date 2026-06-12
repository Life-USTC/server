import {
  getDashboardLinkVisitRoute,
  postDashboardLinkVisitRoute,
} from "@/lib/api/routes/dashboard-links";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Redirect to one dashboard link without side effects.
 * @params dashboardLinkVisitQuerySchema
 * @response 307
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getDashboardLinkVisitRoute),
);
/**
 * Record one dashboard link visit and redirect.
 * @body dashboardLinkVisitRequestSchema
 * @response 303
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkVisitRoute),
);
