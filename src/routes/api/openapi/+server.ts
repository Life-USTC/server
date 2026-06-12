import { getOpenApiRoute } from "@/lib/api/routes/openapi";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get generated OpenAPI document.
 * @response openApiDocumentResponseSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getOpenApiRoute));
