import { getCurrentSemesterRoute } from "@/lib/api/routes/academic-metadata-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get current semester.
 * @response semesterSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute((_request) => getCurrentSemesterRoute()),
);
