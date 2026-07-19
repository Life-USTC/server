import { OAUTH_OPENID_SCOPE } from "@/lib/oauth/constants";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

export type OAuthAuthPatternOption = {
  descriptionKey: string;
  titleKey: string;
  value: string;
};

export type OAuthScopeOption = {
  value: string;
};

export const oauthScopeOptions: OAuthScopeOption[] = OAUTH_SCOPES.filter(
  (scope) => scope !== OAUTH_OPENID_SCOPE,
).map((value) => ({ value }));

const defaultOAuthAuthPatternOption: OAuthAuthPatternOption = {
  value: "client_secret_basic",
  titleKey: "strategyFirstPartyTitle",
  descriptionKey: "strategyFirstPartyDescription",
};

export const oauthAuthPatternOptions: OAuthAuthPatternOption[] = [
  defaultOAuthAuthPatternOption,
  {
    value: "none",
    titleKey: "strategyPublicTitle",
    descriptionKey: "strategyPublicDescription",
  },
  {
    value: "client_secret_post",
    titleKey: "strategyAdvancedTitle",
    descriptionKey: "strategyAdvancedDescription",
  },
];

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
