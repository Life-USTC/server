import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const dynamic = "force-dynamic";

/**
 * Canonical RFC 9728 protected resource metadata for MCP.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute(
  "protectedResourceMetadata",
);
