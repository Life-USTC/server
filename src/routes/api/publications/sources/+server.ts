import { getPublicationSourcesRoute } from "@/lib/api/routes/publication-public-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List registered publication sources grouped by organization level.
 * @response publicPublicationSourceDirectoryResponseSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getPublicationSourcesRoute),
);
