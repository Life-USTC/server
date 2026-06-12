import { getMeRoute } from "@/lib/api/routes/me";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Return the authenticated user's profile.
 * @response meResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getMeRoute));
