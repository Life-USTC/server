import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import {
  SETTINGS_TABS,
  type SettingsTab,
  settingsTabFromPathname,
} from "@/features/settings/lib/settings-tabs";
import type { LayoutLoad } from "./$types";

function settingsNavItem(
  copy: ReturnType<typeof getSettingsCopy>,
  id: SettingsTab,
) {
  const navCopy = copy.settings.nav[id];
  return {
    description: navCopy.description,
    href: `/account/settings/${id}`,
    icon: id,
    id,
    title: navCopy.title,
  };
}

export const load: LayoutLoad = async ({ parent, url }) => {
  const parentData = await parent();
  const copy = getSettingsCopy(parentData.locale);
  return {
    activeTab: settingsTabFromPathname(url.pathname),
    settingsNav: {
      title: copy.settings.title,
      tabs: SETTINGS_TABS.map((id) => settingsNavItem(copy, id)),
    },
  };
};
