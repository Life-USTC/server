import { getDescriptionRoute } from "@/lib/api/routes/description-read-route";
import { postDescriptionRoute } from "@/lib/api/routes/description-upsert-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get description history.
 * @params descriptionsQuerySchema
 * @response descriptionsResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getDescriptionRoute));
/**
 * Upsert description.
 * @body descriptionUpsertRequestSchema
 * @response descriptionUpsertResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDescriptionRoute),
);
