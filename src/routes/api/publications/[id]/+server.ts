import type { RequestHandler } from "@sveltejs/kit";
import { getPublicPublicationRoute } from "@/lib/api/routes/publication-public-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get one public USTC news item or notice.
 * @pathParams publicationIdPathParamsSchema
 * @response publicPublicationDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getPublicPublicationRoute(request, { id: params.id }))(
    request,
  );
