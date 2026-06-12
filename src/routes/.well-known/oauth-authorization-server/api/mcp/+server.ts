import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * Compatibility alias for clients that probe resource-path authorization-server metadata.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("authServerAlias");
