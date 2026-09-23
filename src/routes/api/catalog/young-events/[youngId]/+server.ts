import type { RequestHandler } from "@sveltejs/kit";
import { getYoungEventDetailRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get a second-classroom (Young) signup event.
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response youngEventDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getYoungEventDetailRoute(request, { youngId: params.youngId }),
  )(request);
