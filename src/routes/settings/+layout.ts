import { getSettingsCopy } from "@/lib/settings-copy";
import type { LayoutLoad } from "./$types";

const SETTINGS_TABS = new Set(["profile", "accounts", "content", "danger"]);

function normalizeTab(value: string | null | undefined) {
  return value && SETTINGS_TABS.has(value) ? value : "profile";
}

export const load: LayoutLoad = async ({ parent, url }) => {
  const parentData = await parent();
  const copy = getSettingsCopy(parentData.locale);
  return {
    activeTab: normalizeTab(
      url.searchParams.get("tab") ?? url.pathname.split("/")[2],
    ),
    settingsNav: {
      title: copy.settings.title,
      tabs: [
        {
          description: copy.settings.nav.profile.description,
          href: "/settings/profile",
          icon: "profile",
          id: "profile",
          title: copy.settings.nav.profile.title,
        },
        {
          description: copy.settings.nav.accounts.description,
          href: "/settings/accounts",
          icon: "accounts",
          id: "accounts",
          title: copy.settings.nav.accounts.title,
        },
        {
          description: copy.settings.nav.content.description,
          href: "/settings/content",
          icon: "content",
          id: "content",
          title: copy.settings.nav.content.title,
        },
        {
          description: copy.settings.nav.danger.description,
          href: "/settings/danger",
          icon: "danger",
          id: "danger",
          title: copy.settings.nav.danger.title,
        },
      ],
    },
  };
};
