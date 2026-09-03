import { postPublicationObjectPlanRoute } from "@/lib/api/routes/publication-ingestion-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Plan content-addressed publication object uploads.
 * @body publicationObjectPlanRequestSchema
 * @ingestionSecret X-Publication-Ingestion-Secret
 * @response publicationObjectPlanResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postPublicationObjectPlanRoute),
);
