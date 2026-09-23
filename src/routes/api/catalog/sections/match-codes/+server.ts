import { postSectionMatchCodesRoute } from "@/lib/api/routes/academic-section-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Match section codes.
 * @body matchSectionCodesRequestSchema
 * @response matchSectionCodesResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST = svelteRequestHandler(
  observedApiRoute(postSectionMatchCodesRoute),
);
