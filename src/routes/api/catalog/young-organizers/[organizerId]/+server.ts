import type { RequestHandler } from "@sveltejs/kit";
import { getYoungOrganizerDetailRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Fetch one normalized Young organizer and its event groups.
 * @pathParams youngOrganizerIdPathParamsSchema
 * @response youngOrganizerSummarySchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() =>
    getYoungOrganizerDetailRoute(request, { organizerId: params.organizerId }),
  )(request);
