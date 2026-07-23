import {
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  PUBLIC_REST_FEATURES,
  REST_FEATURES,
  type RestFeature,
  restReadScope,
  restWriteScope,
} from "./constants";

export { restReadScope, restWriteScope };

export type FeatureScopeRequirement = {
  feature: RestFeature;
  action: "read" | "write";
};

export function getRequiredFeatureScope(
  requirement: FeatureScopeRequirement,
): string {
  return requirement.action === "write"
    ? restWriteScope(requirement.feature)
    : restReadScope(requirement.feature);
}

export function hasRequiredFeatureScope(
  scopes: ReadonlySet<string>,
  requirement: FeatureScopeRequirement,
): boolean {
  const readScope = restReadScope(requirement.feature);
  const writeScope = restWriteScope(requirement.feature);
  return requirement.action === "write"
    ? scopes.has(writeScope)
    : scopes.has(readScope) || scopes.has(writeScope);
}

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

export const CLIENT_REGISTRATION_ALLOWED_SCOPES = PUBLIC_OAUTH_SCOPES;

/**
 * Full provider scope vocabulary, including admin-only scopes for clients
 * created explicitly through the admin backend.
 */
export const OAUTH_PROVIDER_SCOPES = OAUTH_SCOPES;

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
  return isPublicFeatureScope(scope);
}

export function hasMcpScope(scopes: readonly string[]): boolean {
  return scopes.some(isMcpScope);
}

export function expandScopeClaim(scope: unknown): Set<string> {
  const raw = Array.isArray(scope)
    ? scope
    : typeof scope === "string"
      ? scope.split(/\s+/)
      : [];
  return new Set(raw.filter((s): s is string => typeof s === "string"));
}
