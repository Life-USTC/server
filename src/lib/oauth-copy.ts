import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../messages/en-us.json";
import zhCnMessages from "../../messages/zh-cn.json";

const oauthMessages = {
  "en-us": enUsMessages.oauth,
  "zh-cn": zhCnMessages.oauth,
} satisfies Record<AppLocale, typeof enUsMessages.oauth>;

export function getOAuthCopy(locale: AppLocale) {
  return oauthMessages[locale];
}

export function formatOAuthMessage(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function oauthScopeLabel(locale: AppLocale, scope: string) {
  const copy = getOAuthCopy(locale);
  const key = `scope_${scope}` as keyof typeof copy;
  const value = copy[key];
  return typeof value === "string" ? value : scope;
}
