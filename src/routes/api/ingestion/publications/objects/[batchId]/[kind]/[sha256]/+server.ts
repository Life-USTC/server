import type { RequestHandler } from "@sveltejs/kit";
import { putPublicationObjectRoute } from "@/lib/api/routes/publication-ingestion-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Stream and verify one content-addressed publication object through the
 * authenticated Worker R2 binding.
 * @pathParams publicationObjectUploadParamsSchema
 * @ingestionSecret X-Publication-Ingestion-Secret
 * @response publicationObjectUploadResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    putPublicationObjectRoute(request, {
      batchId: params.batchId,
      kind: params.kind,
      sha256: params.sha256,
    }),
  )(request);
