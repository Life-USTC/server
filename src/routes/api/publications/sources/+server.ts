import { getDemoPublicationSourcesRoute } from "@/lib/api/routes/demo-publication-route";
import { getPublicationSourcesRoute } from "@/lib/api/routes/publication-public-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(
  observedApiRoute(getPublicationSourcesRoute),
);

/**
 * List registered publication sources grouped by organization level.
 * @response publicPublicationSourceDirectoryResponseSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoPublicationSourcesRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
