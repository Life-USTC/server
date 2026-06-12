import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../messages/en-us.json";
import zhCnMessages from "../../messages/zh-cn.json";

const settingsMessages = {
  "en-us": {
    accessibility: enUsMessages.accessibility,
    common: enUsMessages.common,
    profile: enUsMessages.profile,
    settings: enUsMessages.settings,
  },
  "zh-cn": {
    accessibility: zhCnMessages.accessibility,
    common: zhCnMessages.common,
    profile: zhCnMessages.profile,
    settings: zhCnMessages.settings,
  },
} satisfies Record<
  AppLocale,
  {
    accessibility: typeof enUsMessages.accessibility;
    common: typeof enUsMessages.common;
    profile: typeof enUsMessages.profile;
    settings: typeof enUsMessages.settings;
  }
>;

export function getSettingsCopy(locale: AppLocale) {
  return settingsMessages[locale];
}
