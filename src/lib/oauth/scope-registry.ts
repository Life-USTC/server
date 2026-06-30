import {
  MCP_FEATURES,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  REST_FEATURES,
  mcpScope,
  restReadScope,
  restWriteScope,
} from "./constants";

export const LEGACY_REST_READ_SCOPE = "rest:read";
export const LEGACY_REST_WRITE_SCOPE = "rest:write";
export const LEGACY_MCP_TOOLS_SCOPE = "mcp:tools";

export const OAUTH_SCOPES = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  ...REST_FEATURES.flatMap((f) => [restReadScope(f), restWriteScope(f)]),
  ...MCP_FEATURES.map(mcpScope),
];

export function expandLegacyScope(scope: string): string[] {
  if (scope === LEGACY_REST_READ_SCOPE) {
    return REST_FEATURES.map(restReadScope);
  }
  if (scope === LEGACY_REST_WRITE_SCOPE) {
    return REST_FEATURES.map(restWriteScope);
  }
  if (scope === LEGACY_MCP_TOOLS_SCOPE) {
    return MCP_FEATURES.map(mcpScope);
  }
  return [scope];
}

export function expandScopeClaim(scope: unknown): Set<string> {
  const raw = Array.isArray(scope)
    ? scope
    : typeof scope === "string"
      ? scope.split(/\s+/)
      : [];
  return new Set(
    raw.flatMap(expandLegacyScope).filter((s): s is string => typeof s === "string"),
  );
}
