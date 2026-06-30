import {
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

export type OAuthAuthPatternOption = {
  descriptionKey: string;
  hintKey: string;
  labelKey: string;
  titleKey: string;
  value: string;
};

export type OAuthScopeOption = {
  descriptionKey: string;
  value: string;
};

function resolveScopeDescriptionKey(scope: string): string {
  if (scope === OAUTH_PROFILE_SCOPE) return "scopeProfileDescription";
  if (scope === OAUTH_EMAIL_SCOPE) return "scopeEmailDescription";
  if (scope === OAUTH_OFFLINE_ACCESS_SCOPE) return "scopeOfflineAccessDescription";
  if (scope.startsWith("rest:") && scope.endsWith(":read")) {
    return "scopeRestReadDescription";
  }
  if (scope.startsWith("rest:") && scope.endsWith(":write")) {
    return "scopeRestWriteDescription";
  }
  if (scope.startsWith("mcp:")) return "scopeMcpToolsDescription";
  return `scopeDescription_${scope.replace(/:/g, "_")}`;
}

export const oauthScopeOptions: OAuthScopeOption[] = OAUTH_SCOPES.filter(
  (scope) => scope !== OAUTH_OPENID_SCOPE,
).map((scope) => ({
  value: scope,
  descriptionKey: resolveScopeDescriptionKey(scope),
}));

const defaultOAuthAuthPatternOption: OAuthAuthPatternOption = {
  value: "client_secret_basic",
  labelKey: "clientTypeConfidentialBasic",
  titleKey: "strategyFirstPartyTitle",
  descriptionKey: "strategyFirstPartyDescription",
  hintKey: "strategyFirstPartyHint",
};

export const oauthAuthPatternOptions: OAuthAuthPatternOption[] = [
  defaultOAuthAuthPatternOption,
  {
    value: "none",
    labelKey: "clientTypePublic",
    titleKey: "strategyPublicTitle",
    descriptionKey: "strategyPublicDescription",
    hintKey: "strategyPublicHint",
  },
  {
    value: "client_secret_post",
    labelKey: "clientTypeConfidentialPost",
    titleKey: "strategyAdvancedTitle",
    descriptionKey: "strategyAdvancedDescription",
    hintKey: "strategyAdvancedHint",
  },
];

export function buildOAuthClientTabs(copy: Record<string, string>) {
  return [
    ["trusted", copy.clientTrustTrusted],
    ["public", copy.clientTypePublic],
    ["disabled", copy.disabled],
    ["all", copy.filterAll],
  ] as const;
}

export function availableOAuthAuthPatterns(authMethods: string[]) {
  return oauthAuthPatternOptions.filter((option) =>
    authMethods.includes(option.value),
  );
}

export function selectedOAuthAuthPattern(selectedAuthMethod: string) {
  return (
    oauthAuthPatternOptions.find(
      (option) => option.value === selectedAuthMethod,
    ) ?? defaultOAuthAuthPatternOption
  );
}

export function parseOAuthRedirectUris(redirectDraft: string) {
  return redirectDraft
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
