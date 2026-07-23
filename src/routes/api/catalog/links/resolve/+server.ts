import {
  getDashboardLinkVisitRoute,
  postDashboardLinkVisitRoute,
} from "@/lib/api/routes/dashboard-link-visit-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Resolve a public campus link.
 * @params dashboardLinkVisitQuerySchema
 * @response 307
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getDashboardLinkVisitRoute),
);

/**
 * Resolve a public campus link and record an authenticated visit.
 * @body dashboardLinkVisitRequestSchema
 * @response 303
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkVisitRoute),
);
