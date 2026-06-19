import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * MCP resource-relative OpenID discovery compatibility alias.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdAlias");
