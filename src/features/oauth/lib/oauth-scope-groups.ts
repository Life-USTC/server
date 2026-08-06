import {
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";

export type OAuthScopeListItem = {
  label: string;
  value: string;
};

export type OAuthScopeBaseRow = {
  kind: "base";
  label: string;
  value: string;
};

export type OAuthScopeFeatureRow = {
  feature: string;
  featureLabel: string;
  kind: "feature";
  read?: OAuthScopeListItem;
  write?: OAuthScopeListItem;
};

export type OAuthScopePickerRow = OAuthScopeBaseRow | OAuthScopeFeatureRow;

export type OAuthScopePickerGroup = {
  id: string;
  title: string;
  rows: OAuthScopePickerRow[];
};

const BASE_SCOPE_SET = new Set([
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
]);

const GROUP_ORDER = [
  "identity",
  "account",
  "catalog",
  "community",
  "workspace",
  "admin",
  "other",
] as const;

export type OAuthScopeGroupId = (typeof GROUP_ORDER)[number];

export type OAuthScopeGroupLabels = {
  featureLabel: (feature: string) => string;
  groupTitle: (groupId: OAuthScopeGroupId) => string;
};

function parseFeatureScope(scope: string): {
  action: "read" | "write";
  feature: string;
} | null {
  const match = /^(.*):(read|write)$/.exec(scope);
  if (!match) return null;
  return {
    feature: match[1]!,
    action: match[2] as "read" | "write",
  };
}

function groupIdForScope(scope: string): OAuthScopeGroupId {
  if (BASE_SCOPE_SET.has(scope)) return "identity";
  const parsed = parseFeatureScope(scope);
  if (!parsed) return "other";
  if (parsed.feature === "admin") return "admin";
  const prefix = parsed.feature.split(".")[0] ?? "other";
  if (
    prefix === "account" ||
    prefix === "catalog" ||
    prefix === "community" ||
    prefix === "workspace"
  ) {
    return prefix;
  }
  return "other";
}

function humanizeFeature(feature: string) {
  const leaf = feature.includes(".")
    ? feature.slice(feature.lastIndexOf(".") + 1)
    : feature;
  return leaf
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function defaultOAuthFeatureLabel(feature: string) {
  return humanizeFeature(feature);
}

export function buildOAuthScopePickerGroups(
  items: ReadonlyArray<OAuthScopeListItem>,
  labels: OAuthScopeGroupLabels,
): OAuthScopePickerGroup[] {
  const byGroup = new Map<
    OAuthScopeGroupId,
    Map<string, OAuthScopePickerRow>
  >();

  for (const item of items) {
    const groupId = groupIdForScope(item.value);
    let rows = byGroup.get(groupId);
    if (!rows) {
      rows = new Map();
      byGroup.set(groupId, rows);
    }

    if (BASE_SCOPE_SET.has(item.value) || !parseFeatureScope(item.value)) {
      rows.set(`base:${item.value}`, {
        kind: "base",
        label: item.label,
        value: item.value,
      });
      continue;
    }

    const parsed = parseFeatureScope(item.value)!;
    const key = `feature:${parsed.feature}`;
    const existing = rows.get(key);
    const featureRow: OAuthScopeFeatureRow =
      existing && existing.kind === "feature"
        ? existing
        : {
            kind: "feature",
            feature: parsed.feature,
            featureLabel: labels.featureLabel(parsed.feature),
          };

    if (parsed.action === "read") featureRow.read = item;
    else featureRow.write = item;
    rows.set(key, featureRow);
  }

  return GROUP_ORDER.flatMap((groupId) => {
    const rows = byGroup.get(groupId);
    if (!rows || rows.size === 0) return [];
    return [
      {
        id: groupId,
        title: labels.groupTitle(groupId),
        rows: Array.from(rows.values()),
      },
    ];
  });
}

export function scopesInPickerGroup(group: OAuthScopePickerGroup): string[] {
  return group.rows.flatMap((row) => {
    if (row.kind === "base") return [row.value];
    return [row.read?.value, row.write?.value].filter(
      (value): value is string => Boolean(value),
    );
  });
}

export function allPickerScopeValues(
  groups: ReadonlyArray<OAuthScopePickerGroup>,
): string[] {
  return groups.flatMap(scopesInPickerGroup);
}
