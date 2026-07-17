import { getSectionsRoute } from "@/lib/api/routes/academic-section-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List sections.
 * @params sectionsQuerySchema
 * @response paginatedSectionResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getSectionsRoute));
