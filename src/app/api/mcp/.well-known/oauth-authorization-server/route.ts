import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const dynamic = "force-dynamic";

/**
 * Compatibility alias for clients that probe authorization-server metadata relative to /api/mcp.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("authServerAlias");
