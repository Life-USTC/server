import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const dynamic = "force-dynamic";

/**
 * RFC 8414-compatible path form for OpenID provider metadata.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdMetadata");
