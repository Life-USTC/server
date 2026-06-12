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

export const oauthScopeOptions: OAuthScopeOption[] = [
  { value: "openid", descriptionKey: "scopeOpenIdDescription" },
  { value: "profile", descriptionKey: "scopeProfileDescription" },
  { value: "mcp:tools", descriptionKey: "scopeMcpToolsDescription" },
];

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
