import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { expandLegacyScope, OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

type ValidationErrorResult = { error: string };
type ScopesResult = ValidationErrorResult | { scopes: string[] };

// Allowed scopes after expanding legacy coarse scopes into feature scopes.
const ALLOWED_DYNAMIC_CLIENT_SCOPES: ReadonlySet<string> = new Set(
  OAUTH_SCOPES,
);

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

  const expandedScopes = requestedScopes.flatMap(expandLegacyScope);
  const invalidScopes = expandedScopes.filter(
    (scope) => !ALLOWED_DYNAMIC_CLIENT_SCOPES.has(scope),
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
