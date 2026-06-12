import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * RFC 8414-compatible path form for OpenID provider metadata.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdMetadata");
