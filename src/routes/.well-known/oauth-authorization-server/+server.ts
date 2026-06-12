import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * Compatibility alias for legacy clients that probe the root well-known path.
 * The canonical metadata URL for issuer `/api/auth` is path-specific.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("authServerAlias");
