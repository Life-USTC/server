import {
  MCP_FEATURES,
  mcpScope,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  PUBLIC_REST_FEATURES,
  REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "./constants";

export { mcpScope, restReadScope, restWriteScope };

export const LEGACY_REST_READ_SCOPE = "rest:read";
export const LEGACY_REST_WRITE_SCOPE = "rest:write";
export const LEGACY_MCP_TOOLS_SCOPE = "mcp:tools";

const BASE_OAUTH_SCOPES = [
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
] as const;

export const PUBLIC_REST_SCOPES = PUBLIC_REST_FEATURES.flatMap((feature) => [
  restReadScope(feature),
  restWriteScope(feature),
]);

export const PUBLIC_OAUTH_SCOPES = [
  ...BASE_OAUTH_SCOPES,
  ...PUBLIC_REST_SCOPES,
];

export const OAUTH_SCOPES = [
  ...BASE_OAUTH_SCOPES,
  ...REST_FEATURES.flatMap((f) => [restReadScope(f), restWriteScope(f)]),
];

/**
 * Public scopes the OAuth provider will accept during dynamic client
 * registration. Includes canonical feature:action scopes plus legacy REST/MCP
 * spellings so existing public clients keep working. Discovery metadata still
 * advertises canonical public scopes only.
 */
export const CLIENT_REGISTRATION_ALLOWED_SCOPES = [
  ...PUBLIC_OAUTH_SCOPES,
  LEGACY_REST_READ_SCOPE,
  LEGACY_REST_WRITE_SCOPE,
  LEGACY_MCP_TOOLS_SCOPE,
  ...PUBLIC_REST_FEATURES.flatMap((feature) => [
    `rest:${feature}:read`,
    `rest:${feature}:write`,
  ]),
  ...MCP_FEATURES.map(mcpScope),
];

/**
 * Full provider scope vocabulary, including admin-only scopes for clients
 * created explicitly through the admin backend.
 */
export const OAUTH_PROVIDER_SCOPES = [
  ...OAUTH_SCOPES,
  LEGACY_REST_READ_SCOPE,
  LEGACY_REST_WRITE_SCOPE,
  LEGACY_MCP_TOOLS_SCOPE,
  ...REST_FEATURES.flatMap((feature) => [
    `rest:${feature}:read`,
    `rest:${feature}:write`,
  ]),
  ...MCP_FEATURES.map(mcpScope),
];

function legacyFeatureRestScope(scope: string): string[] | null {
  const match = /^rest:([^:]+):(read|write)$/.exec(scope);
  if (!match) return null;
  const [, feature, action] = match;
  if (!REST_FEATURES.includes(feature as (typeof REST_FEATURES)[number])) {
    return null;
  }
  return [`${feature}:${action}`];
}

function legacyMcpScope(scope: string): string[] | null {
  if (!scope.startsWith("mcp:")) return null;
  const feature = scope.slice("mcp:".length);
  if (!MCP_FEATURES.includes(feature as (typeof MCP_FEATURES)[number])) {
    return null;
  }
  const scopes: string[] = [];
  if (REST_FEATURES.includes(feature as (typeof REST_FEATURES)[number])) {
    scopes.push(`${feature}:read`, `${feature}:write`);
  }
  return scopes;
}

export function expandLegacyScope(scope: string): string[] {
  if (scope === LEGACY_REST_READ_SCOPE) {
    return PUBLIC_REST_FEATURES.map(restReadScope);
  }
  if (scope === LEGACY_REST_WRITE_SCOPE) {
    return PUBLIC_REST_FEATURES.map(restWriteScope);
  }
  if (scope === LEGACY_MCP_TOOLS_SCOPE) {
    return PUBLIC_REST_FEATURES.flatMap((feature) => [
      restReadScope(feature),
      restWriteScope(feature),
    ]);
  }
  const legacyRest = legacyFeatureRestScope(scope);
  if (legacyRest) return legacyRest;
  const legacyMcp = legacyMcpScope(scope);
  if (legacyMcp) return legacyMcp;
  return [scope];
}

export function isFeatureScope(scope: string): boolean {
  return REST_FEATURES.some(
    (feature) =>
      scope === restReadScope(feature) || scope === restWriteScope(feature),
  );
}

function isPublicFeatureScope(scope: string): boolean {
  return PUBLIC_REST_FEATURES.some(
    (feature) =>
      scope === restReadScope(feature) || scope === restWriteScope(feature),
  );
}

export function isMcpScope(scope: string): boolean {
  return (
    scope === LEGACY_MCP_TOOLS_SCOPE ||
    MCP_FEATURES.some((feature) => mcpScope(feature) === scope) ||
    isPublicFeatureScope(scope)
  );
}

export function hasMcpScope(scopes: readonly string[]): boolean {
  return scopes.some(isMcpScope);
}

export function hasLegacyMcpScope(scopes: readonly string[]): boolean {
  return scopes.some(
    (scope) =>
      scope === LEGACY_MCP_TOOLS_SCOPE ||
      MCP_FEATURES.some((feature) => mcpScope(feature) === scope),
  );
}

export function expandScopeClaim(scope: unknown): Set<string> {
  const raw = Array.isArray(scope)
    ? scope
    : typeof scope === "string"
      ? scope.split(/\s+/)
      : [];
  return new Set(
    raw
      .flatMap(expandLegacyScope)
      .filter((s): s is string => typeof s === "string"),
  );
}
