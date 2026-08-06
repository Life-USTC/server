import type { OAuthScopeGroupId } from "@/features/oauth/lib/oauth-scope-groups";
import { REST_FEATURES } from "@/lib/oauth/constants";

const GROUP_IDS = [
  "identity",
  "account",
  "catalog",
  "community",
  "workspace",
  "admin",
  "other",
] as const satisfies readonly OAuthScopeGroupId[];

export type OAuthScopesPickerCopy = {
  authorizeAll: string;
  clearAll: string;
  featureLabels?: Record<string, string>;
  groupSelectAll: string;
  groupTitles: Record<OAuthScopeGroupId, string>;
  hint?: string;
  read: string;
  selectedCountLabel: string;
  title?: string;
  write: string;
};

export function buildOAuthScopesPickerCopy(
  copy: Record<string, string>,
  options: {
    hint?: string;
    selectedCountLabel: string;
    title?: string;
  },
): OAuthScopesPickerCopy {
  const groupTitles = Object.fromEntries(
    GROUP_IDS.map((id) => [id, copy[`scopeGroup_${id}`] ?? id]),
  ) as Record<OAuthScopeGroupId, string>;

  const featureLabels = Object.fromEntries(
    [...REST_FEATURES].map((feature) => [
      feature,
      copy[`scopeFeature_${feature}`] ?? feature,
    ]),
  );

  return {
    authorizeAll: copy.authorizeAllScopes ?? "Authorize all",
    clearAll: copy.clearAllScopes ?? "Clear all",
    featureLabels,
    groupSelectAll: copy.scopeGroupSelectAll ?? "Select group",
    groupTitles,
    hint: options.hint,
    read: copy.scopeActionRead ?? "Read",
    selectedCountLabel: options.selectedCountLabel,
    title: options.title,
    write: copy.scopeActionWrite ?? "Manage",
  };
}
