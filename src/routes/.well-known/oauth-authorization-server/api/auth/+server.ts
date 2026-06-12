import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * Canonical RFC 8414 authorization server metadata for issuer `/api/auth`.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("authServerMetadata");
