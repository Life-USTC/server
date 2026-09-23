import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const localeMessages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export function getOAuthCopy(locale: AppLocale) {
  return localeMessages[locale].oauth;
}

export function formatOAuthMessage(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function scopeLabelFromMessages(
  messages: Record<string, unknown>,
  scope: string,
): string | undefined {
  const value = messages[`scope_${scope}`];
  return typeof value === "string" ? value : undefined;
}

export function oauthScopeLabel(locale: AppLocale, scope: string) {
  const oauth = localeMessages[locale].oauth as Record<string, unknown>;
  const scopeKeys = [scope, `workspace.${scope}`];

  for (const scopeKey of scopeKeys) {
    const label = scopeLabelFromMessages(oauth, scopeKey);
    if (label) return label;
  }

  return scope;
}

export function oauthFeatureLabel(locale: AppLocale, feature: string) {
  const oauth = localeMessages[locale].oauth as Record<string, unknown>;
  const value = oauth[`scopeFeature_${feature}`];
  return typeof value === "string" ? value : feature;
}
