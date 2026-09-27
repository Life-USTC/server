import type { RequestHandler } from "@sveltejs/kit";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Redirect to the current immutable poster representation.
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response 302
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getYoungEventImageRoute(request, { youngId: params.youngId }),
  )(request);
