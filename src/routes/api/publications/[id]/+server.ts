import { getDemoPublicationDetailRoute } from "@/lib/api/routes/demo-publication-route";
import { getPublicPublicationRoute } from "@/lib/api/routes/publication-public-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getPublicPublicationRoute(request, { id: params.id }))(
    request,
  );

/**
 * Get one public USTC news item or notice.
 * @pathParams publicationIdPathParamsSchema
 * @response publicPublicationDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoPublicationDetailRoute(
        event.request,
        event.locals.locale,
        event.params.id,
      )
    : ordinaryGET(event);
