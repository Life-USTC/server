import {
  getDescriptionRoute,
  postDescriptionRoute,
} from "@/lib/api/routes/descriptions";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get description and history by target.
 * @params descriptionsQuerySchema
 * @response descriptionsResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getDescriptionRoute));
/**
 * Upsert description by target.
 * @body descriptionUpsertRequestSchema
 * @response descriptionUpsertResponseSchema
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDescriptionRoute),
);
