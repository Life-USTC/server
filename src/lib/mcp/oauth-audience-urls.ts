import { getLocalLoopbackSiblingUrl, uniqueUrls } from "@/lib/mcp/url-utils";
import { getBetterAuthBaseUrl, getPublicOrigin } from "@/lib/site-url";

export const MCP_ROUTE_PATH = "/api/mcp";

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

export function getCanonicalOAuthIssuer(): string {
  return getBetterAuthBaseUrl();
}

export function getOAuthTokenVerificationIssuers(): string[] {
  return [getCanonicalOAuthIssuer()];
}

export function getOAuthRestAudienceUrls(): string[] {
  return [getCanonicalOAuthIssuer()];
}

export function getOAuthMcpAudienceUrls(): string[] {
  const issuer = getCanonicalOAuthIssuer();
  return uniqueUrls([
    ...getOAuthMcpResourceUrls(),
    `${issuer}/oauth2/userinfo`,
    issuer,
  ]);
}

export function getOAuthProviderValidAudiences(): string[] {
  return uniqueUrls([
    ...getOAuthRestAudienceUrls(),
    ...getOAuthMcpResourceUrls(),
  ]);
}
