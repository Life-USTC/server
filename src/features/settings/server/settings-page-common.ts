import type { Cookies } from "@sveltejs/kit";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { AppLocale } from "@/i18n/config";

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
    language: copy.language,
    profile: copy.profile,
    settings: copy.settings,
    theme: copy.theme,
  };
}
