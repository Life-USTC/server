import { postPublicationObjectCompleteRoute } from "@/lib/api/routes/publication-ingestion-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Verify and link one uploaded publication object.
 * @body publicationObjectCompleteRequestSchema
 * @oauthScope publication.ingest:write
 * @response publicationObjectCompleteResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postPublicationObjectCompleteRoute),
);
