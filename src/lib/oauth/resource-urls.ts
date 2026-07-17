import { getLocalLoopbackSiblingUrl, uniqueUrls } from "@/lib/oauth/url-utils";
import { getBetterAuthBaseUrl, getPublicOrigin } from "@/lib/site-url";

export const MCP_ROUTE_PATH = "/api/mcp";
export const GRAPHQL_ROUTE_PATH = "/api/graphql";

/**
 * OAuth resource indicator / access-token audience for MCP. This is the public
 * MCP endpoint, not a Better Auth route under `/api/auth`.
 */
export function getOAuthMcpResourceUrl(): string {
  return `${getPublicOrigin()}${MCP_ROUTE_PATH}`;
}

export function getOAuthMcpResourceUrls(): string[] {
  const mcpResourceUrl = getOAuthMcpResourceUrl();
  const localMcpResourceUrl = getLocalLoopbackSiblingUrl(mcpResourceUrl);
  return uniqueUrls([
    mcpResourceUrl,
    ...(localMcpResourceUrl ? [localMcpResourceUrl] : []),
  ]);
}

/**
 * OAuth resource indicator / access-token audience for GraphQL. Unlike the
 * legacy REST audience, this resource is endpoint-specific so tokens cannot be
 * replayed between REST, MCP, and GraphQL.
 */
export function getOAuthGraphqlResourceUrl(): string {
  return `${getPublicOrigin()}${GRAPHQL_ROUTE_PATH}`;
}

export function getOAuthGraphqlResourceUrls(): string[] {
  const graphqlResourceUrl = getOAuthGraphqlResourceUrl();
  const localGraphqlResourceUrl =
    getLocalLoopbackSiblingUrl(graphqlResourceUrl);
  return uniqueUrls([
    graphqlResourceUrl,
    ...(localGraphqlResourceUrl ? [localGraphqlResourceUrl] : []),
  ]);
}

export function getCanonicalOAuthIssuer(): string {
  return getBetterAuthBaseUrl();
}

export function getOAuthTokenVerificationIssuers(): string[] {
  return [getCanonicalOAuthIssuer()];
}

export function getOAuthRestAudienceUrls(): string[] {
  const issuer = getCanonicalOAuthIssuer();
  const localIssuer = getLocalLoopbackSiblingUrl(issuer);
  return uniqueUrls([issuer, ...(localIssuer ? [localIssuer] : [])]);
}

export function getOAuthMcpAudienceUrls(): string[] {
  const issuer = getCanonicalOAuthIssuer();
  return uniqueUrls([
    ...getOAuthMcpResourceUrls(),
    `${issuer}/oauth2/userinfo`,
    issuer,
  ]);
}

export function getOAuthGraphqlAudienceUrls(): string[] {
  return getOAuthGraphqlResourceUrls();
}

export function getOAuthProviderValidAudiences(): string[] {
  return uniqueUrls([
    ...getOAuthRestAudienceUrls(),
    ...getOAuthMcpResourceUrls(),
    ...getOAuthGraphqlResourceUrls(),
  ]);
}
