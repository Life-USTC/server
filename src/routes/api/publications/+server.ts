import { getDemoPublicationsRoute } from "@/lib/api/routes/demo-publication-route";
import { getPublicationsRoute } from "@/lib/api/routes/publication-public-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(
  observedApiRoute(getPublicationsRoute),
);

/**
 * List public USTC news and notices.
 * @params publicationsQuerySchema
 * @response publicPublicationsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoPublicationsRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
