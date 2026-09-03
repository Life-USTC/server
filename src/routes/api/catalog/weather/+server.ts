import { getWeatherRoute } from "@/lib/api/routes/weather";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Query weather for a USTC campus.
 * @params weatherQuerySchema
 * @response weatherSnapshotResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getWeatherRoute));
