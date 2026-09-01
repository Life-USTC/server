import type { RequestHandler } from "@sveltejs/kit";
import { getPublicPublicationObjectRoute } from "@/lib/api/routes/publication-public-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Read a verified object linked to a public publication revision.
 * @pathParams publicationObjectPathParamsSchema
 * @response binary
 * @response 304
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getPublicPublicationObjectRoute(request, {
      kind: params.kind,
      sha256: params.sha256,
    }),
  )(request);
