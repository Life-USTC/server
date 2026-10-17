import { getYoungOrganizerDetailRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

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
