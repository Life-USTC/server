import {
  getDashboardLinkPinsRoute,
  postDashboardLinkPinRoute,
} from "@/lib/api/routes/dashboard-link-pin-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List the current user's pinned campus links.
 * @response workspaceLinkPinResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getDashboardLinkPinsRoute),
);

/**
 * Set one campus link pin.
 * @body workspaceLinkPinRequestSchema
 * @response workspaceLinkPinResponseSchema
 * @response 303
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 500:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDashboardLinkPinRoute),
);
