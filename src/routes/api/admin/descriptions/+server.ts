import { getAdminDescriptionsRoute } from "@/lib/api/routes/admin-descriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List descriptions.
 * @params adminDescriptionsQuerySchema
 * @response adminDescriptionsResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAdminDescriptionsRoute),
);
