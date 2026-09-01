import { getPublicationsRoute } from "@/lib/api/routes/publication-public-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List public USTC news and notices.
 * @params publicationsQuerySchema
 * @response publicPublicationsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getPublicationsRoute));
