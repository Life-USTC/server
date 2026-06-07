import { getBetterAuthBaseUrl, getPublicOrigin } from "@/lib/site-url";

const MCP_ROUTE_PATH = "/api/mcp";

function uniqueUrls(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\/$/, "")))];
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function toUrl(target: URL | string): URL {
  return new URL(target.toString());
}

function getLocalLoopbackSiblingUrl(target: string): string | null {
  const url = new URL(target);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    return url.toString();
  }
  if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    return url.toString();
  }
  return null;
}

function insertWellKnownPath(target: URL | string, suffix: string): URL {
  const url = toUrl(target);
  const normalizedPathname = normalizePathname(url.pathname);
  return new URL(
    `/.well-known/${suffix}${normalizedPathname}${url.search}`,
    `${url.origin}/`,
  );
}

function appendWellKnownPath(target: URL | string, suffix: string): URL {
  const url = toUrl(target);
  const normalizedPathname = normalizePathname(url.pathname);
  return new URL(
    `${normalizedPathname}/.well-known/${suffix}${url.search}`,
    `${url.origin}/`,
  );
}

/**
 * OAuth resource indicator / access-token audience for MCP. This is the public
 * MCP endpoint, not a Better Auth route under `/api/auth`.
 */
export function getOAuthMcpResourceUrl(): string {
  return `${getPublicOrigin()}${MCP_ROUTE_PATH}`;
}

function getOAuthMcpResourceUrls(): string[] {
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

export function getJwksUrlForOAuthVerification(): string {
  return new URL("/api/auth/jwks", `${getCanonicalOAuthIssuer()}/`).toString();
}

export function getMcpServerUrl(): URL {
  return new URL(getOAuthMcpResourceUrl());
}

export function getOAuthIssuerUrl(): URL {
  return new URL(getCanonicalOAuthIssuer());
}

export function getOAuthAuthorizationServerMetadataUrl(): URL {
  return insertWellKnownPath(getOAuthIssuerUrl(), "oauth-authorization-server");
}

export function getOAuthProtectedResourceMetadataUrl(): URL {
  return insertWellKnownPath(getMcpServerUrl(), "oauth-protected-resource");
}

export function getOAuthOpenIdConfigurationUrl(): URL {
  return appendWellKnownPath(getOAuthIssuerUrl(), "openid-configuration");
}
