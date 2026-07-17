import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

const graphqlProtectedResourceMetadata = createOAuthDiscoveryRoute(
  "graphqlProtectedResourceMetadata",
);

/**
 * Canonical RFC 9728 protected resource metadata for GraphQL.
 * @response 200
 */
export const GET = graphqlProtectedResourceMetadata.GET;

/**
 * CORS preflight for GraphQL protected resource metadata.
 * @response 204
 */
export const OPTIONS = graphqlProtectedResourceMetadata.OPTIONS;
