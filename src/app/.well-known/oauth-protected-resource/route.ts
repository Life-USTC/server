import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const dynamic = "force-dynamic";

/**
 * Compatibility alias for clients that probe the resource-origin root path.
 * The canonical RFC 9728 URL is path-specific for resource `/api/mcp`.
 * @response 307
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute(
  "protectedResourceAlias",
);
