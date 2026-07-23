import { getSemestersRoute } from "@/lib/api/routes/academic-metadata-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List semesters.
 * @params semestersQuerySchema
 * @response paginatedSemesterResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getSemestersRoute));
