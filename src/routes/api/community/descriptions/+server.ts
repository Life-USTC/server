import { getDemoDescriptionRoute } from "@/lib/api/routes/demo-catalog-read-routes";
import { getDescriptionRoute } from "@/lib/api/routes/description-read-route";
import { postDescriptionRoute } from "@/lib/api/routes/description-upsert-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get description history.
 * @params descriptionsQuerySchema
 * @response descriptionsResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @anonymous
 * @oauthScope community.description:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoDescriptionRoute(event.request, event.locals.locale)
    : svelteRequestHandler(observedApiRoute(getDescriptionRoute))(event);
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
 * @oauthScope community.description:write
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postDescriptionRoute),
);
