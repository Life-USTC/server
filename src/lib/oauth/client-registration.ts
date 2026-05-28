import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

type ValidationErrorResult = { error: string };
type ScopesResult = ValidationErrorResult | { scopes: string[] };

const SUPPORTED_DYNAMIC_CLIENT_SCOPES = new Set([
  ...DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
]);

function parseRequestedScopes(input?: string[] | string | null) {
  if (typeof input === "string") {
    return input.split(" ").filter(Boolean);
  }

  return input ?? [];
}

export function resolveOAuthClientScopes(
  requestedScopesInput?: string[] | string | null,
): ScopesResult {
  const requestedScopes = parseRequestedScopes(requestedScopesInput);

  if (requestedScopes.length === 0) {
    return { scopes: [...DEFAULT_OAUTH_CLIENT_SCOPES] };
  }

  const invalidScopes = requestedScopes.filter(
    (scope) => !SUPPORTED_DYNAMIC_CLIENT_SCOPES.has(scope),
  );

  if (invalidScopes.length > 0) {
    return {
      error: `Unsupported scopes requested: ${invalidScopes.join(", ")}`,
    };
  }

  return { scopes: [...new Set(requestedScopes)] };
}

export function resolveOAuthClientGrantTypes(scopes: readonly string[]) {
  return scopes.includes(OAUTH_OFFLINE_ACCESS_SCOPE)
    ? [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE, OAUTH_REFRESH_TOKEN_GRANT_TYPE]
    : [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE];
}
