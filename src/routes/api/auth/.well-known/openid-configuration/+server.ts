import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * OpenID Connect discovery metadata for issuer `/api/auth`.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdMetadata");
