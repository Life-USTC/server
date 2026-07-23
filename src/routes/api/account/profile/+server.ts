import { getAccountProfileRoute } from "@/lib/api/routes/account-profile-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get the current account profile.
 * @response meResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getAccountProfileRoute),
);
