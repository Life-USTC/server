import { getDemoPublicationObjectRoute } from "@/lib/api/routes/demo-publication-route";
import { getPublicPublicationObjectRoute } from "@/lib/api/routes/publication-public-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getPublicPublicationObjectRoute(request, {
      kind: params.kind,
      sha256: params.sha256,
    }),
  )(request);

/**
 * Read a verified object linked to a public publication revision.
 * @pathParams publicationObjectPathParamsSchema
 * @response binary
 * @response 304
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoPublicationObjectRoute(
        event.request,
        event.params.kind,
        event.params.sha256,
      )
    : ordinaryGET(event);
