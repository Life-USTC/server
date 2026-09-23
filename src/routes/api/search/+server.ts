import { getGlobalSearchRoute } from "@/lib/api/routes/global-search";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Global search across catalog and workspace entities.
 * @params q, limit, locale, scope
 * @response globalSearchResponse
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getGlobalSearchRoute));
