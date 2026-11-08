import { getDemoYoungPosterRedirect } from "@/lib/api/routes/demo-young-route";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Legacy event-poster resolver; prefer /api/catalog/young-events/by-id/{youngId}/image.
 * Event ID images requires the canonical resolver: /images/image retains its
 * existing immutable inline-image meaning.
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
