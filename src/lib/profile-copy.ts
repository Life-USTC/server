import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../messages/en-us.json";
import zhCnMessages from "../../messages/zh-cn.json";

const profileMessages = {
  "en-us": {
    common: enUsMessages.common,
    publicProfile: enUsMessages.publicProfile,
  },
  "zh-cn": {
    common: zhCnMessages.common,
    publicProfile: zhCnMessages.publicProfile,
  },
} satisfies Record<
  AppLocale,
  {
    common: typeof enUsMessages.common;
    publicProfile: typeof enUsMessages.publicProfile;
  }
>;

export type ProfileCopy = (typeof profileMessages)[AppLocale];

export function getProfileCopy(locale: AppLocale) {
  return profileMessages[locale];
}
