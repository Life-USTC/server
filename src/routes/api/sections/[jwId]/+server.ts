import type { RequestHandler } from "@sveltejs/kit";
import { getSectionDetailRoute } from "@/lib/api/routes/academic";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get section.
 * @pathParams jwIdPathParamsSchema
 * @response sectionDetailSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getSectionDetailRoute({ jwId: params.jwId }))(request);
