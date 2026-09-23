import { getCatalogLinksRoute } from "@/lib/api/routes/catalog-link-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List public campus links.
 * @params localeQuerySchema
 * @response catalogLinkListResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getCatalogLinksRoute));
