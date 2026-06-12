import {
  getCanonicalOAuthIssuer,
  getOAuthMcpResourceUrl,
} from "@/lib/mcp/oauth-audience-urls";
import { appendWellKnownPath, insertWellKnownPath } from "@/lib/mcp/url-utils";

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
