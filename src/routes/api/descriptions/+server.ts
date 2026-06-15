import {
  getDescriptionRoute,
  postDescriptionRoute,
} from "@/lib/api/routes/descriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get description history.
 * @params descriptionsQuerySchema
 * @response descriptionsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getDescriptionRoute));
/**
 * Upsert description.
 * @body descriptionUpsertRequestSchema
 * @response descriptionUpsertResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDescriptionRoute),
);
