import { error } from "@sveltejs/kit";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { getDemoAccountProfile } from "@/features/demo/server/demo-profile";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { getSettingsPageData } from "@/features/settings/server/settings-page-data";
import { getSettingsPageCopy } from "@/features/settings/server/settings-page-server";
import type { AppLocale } from "@/i18n/config";

export type SettingsPageLoadInput = {
  locals: {
    locale: AppLocale;
    demo?: DemoIdentity | null;
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
  if (locals.demo) {
    if (tab !== "profile") error(403, "DEMO_READ_ONLY");
    return {
      tab: "profile" as const,
      message: null,
      user: {
        ...getDemoAccountProfile(locals.demo, locals.locale),
        profilePictures: [] as string[],
      },
      accounts: [],
      authorizations: [],
      securityActivity: { hasCursor: false, items: [], nextCursor: null },
      demo: getDemoView(locals.demo, locals.locale),
      copy: getSettingsPageCopy(locals.locale),
    };
  }
  return {
    ...(await getSettingsPageData(request, url, tab)),
    copy: getSettingsPageCopy(locals.locale),
  };
}
