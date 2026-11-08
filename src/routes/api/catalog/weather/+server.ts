import { getDemoWeatherRoute } from "@/lib/api/routes/demo-campus-route";
import { getWeatherRoute } from "@/lib/api/routes/weather";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(observedApiRoute(getWeatherRoute));

/**
 * Query weather for a USTC campus.
 * @params weatherQuerySchema
 * @response weatherSnapshotResponseSchema
 * @response 400:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoWeatherRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
