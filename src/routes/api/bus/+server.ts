import { getBusRoute } from "@/lib/api/routes/bus";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Public shuttle-bus query API.
 * @params busQuerySchema
 * @response busQueryResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getBusRoute));
