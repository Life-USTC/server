export const OIDC_PROVIDER_ID = "oidc";
export const DEV_DEBUG_PROVIDER_ID = "dev-debug";
export const DEV_ADMIN_PROVIDER_ID = "dev-admin";

const PRIMARY_SIGN_IN_PROVIDER_IDS = [
  OIDC_PROVIDER_ID,
  "github",
  "google",
] as const;
const DEBUG_SIGN_IN_PROVIDER_IDS = [
  DEV_DEBUG_PROVIDER_ID,
  DEV_ADMIN_PROVIDER_ID,
] as const;
const DEBUG_SIGN_IN_PROVIDER_ID_SET = new Set<string>(
  DEBUG_SIGN_IN_PROVIDER_IDS,
);
const ALL_SIGN_IN_PROVIDER_IDS = [
  ...PRIMARY_SIGN_IN_PROVIDER_IDS,
  ...DEBUG_SIGN_IN_PROVIDER_IDS,
] as const;

export type DebugProviderId = (typeof DEBUG_SIGN_IN_PROVIDER_IDS)[number];
type AuthProviderDecision =
  | { kind: "none" }
  | { kind: "debug"; providerId: DebugProviderId }
  | { kind: "oidc"; providerId: typeof OIDC_PROVIDER_ID }
  | { kind: "social"; providerId: string };

function isDebugProviderId(providerId: string): providerId is DebugProviderId {
  return DEBUG_SIGN_IN_PROVIDER_ID_SET.has(providerId);
}

export function resolveAuthProviderDecision(
  providerId?: string,
): AuthProviderDecision {
  if (!providerId) {
    return { kind: "none" };
  }

  if (isDebugProviderId(providerId)) {
    return { kind: "debug", providerId };
  }

  if (providerId === OIDC_PROVIDER_ID) {
    return { kind: "oidc", providerId };
  }

  return { kind: "social", providerId };
}

export function getSignInProviderIds(includeDebugProviders: boolean) {
  return includeDebugProviders
    ? ALL_SIGN_IN_PROVIDER_IDS
    : PRIMARY_SIGN_IN_PROVIDER_IDS;
}
