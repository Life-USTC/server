import { getSettingsPageData } from "@/features/settings/server/settings-page-data";
import { getSettingsPageCopy } from "@/features/settings/server/settings-page-server";
import type { AppLocale } from "@/i18n/config";

export type SettingsPageLoadInput = {
  locals: {
    locale: AppLocale;
  };
  request: Request;
  url: URL;
};

export async function loadSettingsPage({
  locals,
  request,
  url,
}: SettingsPageLoadInput) {
  return {
    ...(await getSettingsPageData(request, url)),
    copy: getSettingsPageCopy(locals.locale),
  };
}
