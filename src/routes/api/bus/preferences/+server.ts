import {
  getBusPreferencesRoute,
  postBusPreferencesRoute,
} from "@/lib/api/routes/bus";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get bus preferences.
 * @response busPreferenceResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getBusPreferencesRoute),
);
/**
 * Update bus preferences.
 * @body busPreferenceRequestSchema
 * @response busPreferenceResponseSchema
 * @response 401:openApiErrorSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postBusPreferencesRoute),
);
