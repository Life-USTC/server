import type { RequestHandler } from "@sveltejs/kit";
import {
  getYoungOrganizerStateRoute,
  putYoungSubscriptionRoute,
} from "@/lib/api/routes/young-workspace-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * Set personal organizers subscription state. This does not register attendance.
 * @body youngOrganizerSubscriptionRequestSchema
 * @pathParams youngOrganizerIdPathParamsSchema
 * @response youngOrganizerSubscriptionStateSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const PUT: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    putYoungSubscriptionRoute(request, params.organizerId ?? "", "organizers"),
  )(request);
/**
 * Read personal organizer follow state.
 * @pathParams youngOrganizerIdPathParamsSchema
 * @response youngOrganizerSubscriptionStateSchema
 * @response 401:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getYoungOrganizerStateRoute(request, params.organizerId ?? ""),
  )(request);
