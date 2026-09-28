import { postWorkspaceLinkPinBatchRoute } from "@/lib/api/routes/workspace-link-pin-route";
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
 * @oauthScope workspace.link-pin:write
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postWorkspaceLinkPinBatchRoute),
);
