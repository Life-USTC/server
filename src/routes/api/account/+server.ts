import { getMeRoute } from "@/lib/api/routes/me";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get current user.
 * @response meResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getMeRoute));
