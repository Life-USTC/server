import { getMetadataRoute } from "@/lib/api/routes/academic";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get metadata dictionaries for filters.
 * @response metadataResponseSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(() => getMetadataRoute()),
);
