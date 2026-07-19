import type { RequestHandler } from "@sveltejs/kit";
import { getSectionDetailRoute } from "@/lib/api/routes/academic-section-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get section.
 * @pathParams jwIdPathParamsSchema
 * @params catalogLocaleQuerySchema
 * @response sectionDetailSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionDetailRoute(request, { jwId: params.jwId }))(
    request,
  );
