import type { Cookies } from "@sveltejs/kit";
import type { AppLocale } from "@/i18n/config";
import { getSettingsCopy } from "@/lib/settings-copy";

export type SettingsActionInput = {
  cookies?: Cookies;
  locale: AppLocale;
  request: Request;
  url: URL;
};

export function getSettingsPageCopy(locale: AppLocale) {
  const copy = getSettingsCopy(locale);
  return {
    accessibility: copy.accessibility,
    common: copy.common,
    profile: copy.profile,
    settings: copy.settings,
  };
}
