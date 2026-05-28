import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const dynamic = "force-dynamic";

/**
 * Canonical OpenID Connect Discovery metadata for issuer `/api/auth`.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdMetadata");
