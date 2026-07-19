import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const settingsMessages = {
  "en-us": {
    accessibility: enUsMessages.accessibility,
    common: enUsMessages.common,
    language: enUsMessages.language,
    profile: enUsMessages.profile,
    settings: enUsMessages.settings,
    theme: enUsMessages.theme,
  },
  "zh-cn": {
    accessibility: zhCnMessages.accessibility,
    common: zhCnMessages.common,
    language: zhCnMessages.language,
    profile: zhCnMessages.profile,
    settings: zhCnMessages.settings,
    theme: zhCnMessages.theme,
  },
} satisfies Record<
  AppLocale,
  {
    accessibility: typeof enUsMessages.accessibility;
    common: typeof enUsMessages.common;
    language: typeof enUsMessages.language;
    profile: typeof enUsMessages.profile;
    settings: typeof enUsMessages.settings;
    theme: typeof enUsMessages.theme;
  }
>;

export function getSettingsCopy(locale: AppLocale) {
  return settingsMessages[locale];
}
