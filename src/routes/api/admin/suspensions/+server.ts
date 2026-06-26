import {
  getAdminSuspensionsRoute,
  postAdminSuspensionRoute,
} from "@/lib/api/routes/admin";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List suspensions.
 * @response adminSuspensionsResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAdminSuspensionsRoute),
);
/**
 * Create suspension for one user.
 * @body adminCreateSuspensionRequestSchema
 * @response adminSuspensionResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postAdminSuspensionRoute),
);
