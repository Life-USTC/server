import { getAdminDescriptionsRoute } from "@/lib/api/routes/admin";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List descriptions for moderation review.
 * @params adminDescriptionsQuerySchema
 * @response adminDescriptionsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAdminDescriptionsRoute),
);
