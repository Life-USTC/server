export const OAUTH_PUBLIC_CLIENT_AUTH_METHOD = "none";
export const OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD = "client_secret_basic";
export const OAUTH_CLIENT_SECRET_POST_AUTH_METHOD = "client_secret_post";
export const OAUTH_AUTHORIZATION_CODE_GRANT_TYPE = "authorization_code";
export const OAUTH_REFRESH_TOKEN_GRANT_TYPE = "refresh_token";
export const OAUTH_DEVICE_CODE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:device_code";
export const OAUTH_CODE_RESPONSE_TYPE = "code";
export const OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH =
  "/api/auth/oauth2/device-authorization";
export const OAUTH_TOKEN_ENDPOINT_PATH = "/api/auth/oauth2/token";
export const OAUTH_OPENID_SCOPE = "openid";
export const OAUTH_PROFILE_SCOPE = "profile";
export const OAUTH_EMAIL_SCOPE = "email";
export const OAUTH_OFFLINE_ACCESS_SCOPE = "offline_access";
export const MCP_TOOLS_SCOPE = "mcp:tools";
export const DEFAULT_OAUTH_CLIENT_SCOPES = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
] as const;
export const OAUTH_PROVIDER_SCOPES = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  MCP_TOOLS_SCOPE,
] as const;
export const SUPPORTED_OAUTH_CLIENT_AUTH_METHODS = [
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
] as const;
const SUPPORTED_OAUTH_CLIENT_AUTH_METHOD_SET = new Set<string>(
  SUPPORTED_OAUTH_CLIENT_AUTH_METHODS,
);

export type SupportedOAuthClientAuthMethod =
  (typeof SUPPORTED_OAUTH_CLIENT_AUTH_METHODS)[number];

export function isSupportedOAuthClientAuthMethod(
  value: string,
): value is SupportedOAuthClientAuthMethod {
  return SUPPORTED_OAUTH_CLIENT_AUTH_METHOD_SET.has(value);
}
