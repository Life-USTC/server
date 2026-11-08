import { getDemoYoungPosterRedirect } from "@/lib/api/routes/demo-young-route";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Redirect to the current immutable poster representation.
 * @pathParams youngEventYoungIdPathParamsSchema
 * @response 302
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, locals }) =>
  locals.demo
    ? getDemoYoungPosterRedirect(request, locals.locale, params.youngId)
    : observedApiRoute(() =>
        getYoungEventImageRoute(request, { youngId: params.youngId }),
      )(request);
