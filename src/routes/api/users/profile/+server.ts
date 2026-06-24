import { getPublicUserProfileRoute } from "@/lib/api/routes/public-user-profile";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get public user profile.
 * @params publicUserProfileQuerySchema
 * @response publicUserProfileResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getPublicUserProfileRoute),
);
