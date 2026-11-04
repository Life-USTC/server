import { getSectionsRoute } from "@/lib/api/routes/academic-section-routes";
import { getDemoSectionListRoute } from "@/lib/api/routes/demo-section-list-route";
import { observedApiRoute } from "@/lib/log/api-observability";

import type { RequestHandler } from "./$types";

/**
 * List sections.
 * @params sectionsQuerySchema
 * @response paginatedSectionResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, locals }) =>
  locals.demo
    ? getDemoSectionListRoute(request, locals.locale)
    : observedApiRoute(getSectionsRoute)(request);
