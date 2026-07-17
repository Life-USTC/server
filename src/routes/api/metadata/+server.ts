import { getMetadataRoute } from "@/lib/api/routes/academic-metadata-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get metadata.
 * @response metadataResponseSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(() => getMetadataRoute()),
);
