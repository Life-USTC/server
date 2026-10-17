import { getSectionDetailRoute } from "@/lib/api/routes/academic-section-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get section.
 * @pathParams jwIdPathParamsSchema
 * @params sectionDetailQuerySchema
 * @response sectionDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionDetailRoute(request, { jwId: params.jwId }))(
    request,
  );
