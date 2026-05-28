import type { LucideIcon } from "lucide-react";
import { Bot, KeyRound, Server, Sparkles } from "lucide-react";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  type SupportedOAuthClientAuthMethod,
} from "@/lib/oauth/constants";

export const DEFAULT_SCOPE_VALUES = [
  ...DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
];
export const DEFAULT_AUTH_METHOD = OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD;

export interface OAuthClientInfo {
  clientId: string;
  name: string;
  tokenEndpointAuthMethod: string;
  redirectUris: string[];
  scopes: string[];
  isTrusted: boolean;
  createdAt: string;
}

export type CreatedCredentials = {
  clientId: string;
  clientSecret: string | null;
  name: string;
  tokenEndpointAuthMethod: string;
  redirectUris: string[];
  scopes: string[];
  isTrusted: boolean;
};

export type OAuthTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type AuthMethodOption = {
  value: SupportedOAuthClientAuthMethod;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
  strategyTitleKey: string;
  strategyDescriptionKey: string;
  strategyHintKey: string;
  accentClassName: string;
  accentIconClassName: string;
  badgeVariant: "info" | "success" | "warning";
};

export const AUTH_METHOD_OPTIONS: AuthMethodOption[] = [
  {
    value: OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
    icon: Server,
    labelKey: "clientTypeConfidentialBasic",
    descriptionKey: "clientTypeBasicDescription",
    strategyTitleKey: "strategyFirstPartyTitle",
    strategyDescriptionKey: "strategyFirstPartyDescription",
    strategyHintKey: "strategyFirstPartyHint",
    accentClassName: "border-foreground bg-muted/45 text-foreground",
    accentIconClassName: "border-border bg-background text-foreground",
    badgeVariant: "info",
  },
  {
    value: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    icon: Bot,
    labelKey: "clientTypePublic",
    descriptionKey: "clientTypePublicDescription",
    strategyTitleKey: "strategyPublicTitle",
    strategyDescriptionKey: "strategyPublicDescription",
    strategyHintKey: "strategyPublicHint",
    accentClassName: "border-foreground bg-muted/45 text-foreground",
    accentIconClassName: "border-border bg-background text-foreground",
    badgeVariant: "success",
  },
  {
    value: OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
    icon: Sparkles,
    labelKey: "clientTypeConfidentialPost",
    descriptionKey: "clientTypePostDescription",
    strategyTitleKey: "strategyAdvancedTitle",
    strategyDescriptionKey: "strategyAdvancedDescription",
    strategyHintKey: "strategyAdvancedHint",
    accentClassName: "border-foreground bg-muted/45 text-foreground",
    accentIconClassName: "border-border bg-background text-foreground",
    badgeVariant: "warning",
  },
];

export const SCOPE_OPTIONS = [
  {
    value: OAUTH_OPENID_SCOPE,
    descriptionKey: "scopeOpenIdDescription",
  },
  {
    value: OAUTH_PROFILE_SCOPE,
    descriptionKey: "scopeProfileDescription",
  },
  {
    value: MCP_TOOLS_SCOPE,
    descriptionKey: "scopeMcpToolsDescription",
  },
] as const;

export function getClientTypeBadgeVariant(method: string) {
  return getAuthMethodOption(method).badgeVariant;
}

export function getClientTypeLabel(t: OAuthTranslator, method: string) {
  return t(getAuthMethodOption(method).labelKey);
}

export function getScopeInputId(scope: string) {
  return `oauth-scope-${scope.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

export function parseRedirectUris(value: string) {
  return value
    .split("\n")
    .map((uri) => uri.trim())
    .filter(Boolean);
}

export function getAuthMethodOption(value: string) {
  return (
    AUTH_METHOD_OPTIONS.find((option) => option.value === value) ??
    AUTH_METHOD_OPTIONS[0]
  );
}

export function isTrustedClientAuthMethod(method: string) {
  return method === OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD;
}

export function isPublicClientAuthMethod(method: string) {
  return method === OAUTH_PUBLIC_CLIENT_AUTH_METHOD;
}

export function getClientPatternDescriptionKey(client: OAuthClientInfo) {
  if (client.isTrusted) {
    return "clientKindTrustedDescription";
  }
  if (isPublicClientAuthMethod(client.tokenEndpointAuthMethod)) {
    return "clientKindPublicDescription";
  }
  return "clientKindExternalDescription";
}

export const AuthMethodLeadIcon = KeyRound;
