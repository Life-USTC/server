import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

/**
 * Canonical RFC 9728 protected resource metadata for GraphQL.
 * @response 200
 */
export const { GET, OPTIONS } = createOAuthDiscoveryRoute(
  "graphqlProtectedResourceMetadata",
);
