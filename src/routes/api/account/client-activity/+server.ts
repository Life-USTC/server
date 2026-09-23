import { getAccountClientActivityRoute } from "@/lib/api/routes/account-client-activity-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List activity performed by the current OAuth client for the current user.
 * Cookie sessions are intentionally not accepted by this endpoint.
 * @oauthScope account.client-activity:read
 * @params accountClientActivityQuerySchema
 * @response accountClientActivityResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAccountClientActivityRoute),
);
