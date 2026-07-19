import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { getSettingsPageData } from "@/features/settings/server/settings-page-data";
import { getSettingsPageCopy } from "@/features/settings/server/settings-page-server";
import type { AppLocale } from "@/i18n/config";

export type SettingsPageLoadInput = {
  locals: {
    locale: AppLocale;
  };
  request: Request;
  tab: SettingsTab;
  url: URL;
};

export async function loadSettingsPage({
  locals,
  request,
  tab,
  url,
}: SettingsPageLoadInput) {
  return {
    ...(await getSettingsPageData(request, url, tab)),
    copy: getSettingsPageCopy(locals.locale),
  };
}
