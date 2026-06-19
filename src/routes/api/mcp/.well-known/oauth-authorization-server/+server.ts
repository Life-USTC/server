import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * MCP resource-relative authorization server metadata compatibility alias.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("authServerAlias");
