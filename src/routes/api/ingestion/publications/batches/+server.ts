import { postPublicationIngestionBatchRoute } from "@/lib/api/routes/publication-ingestion-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Ingest a crawler publication batch.
 * @body publicationIngestionBatchRequestSchema
 * @oauthScope publication.ingest:write
 * @response publicationIngestionBatchResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 409:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postPublicationIngestionBatchRoute),
);
