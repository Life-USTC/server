import type { SettingsCopy } from "@/features/settings/components/settings-component-types";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";

/**
 * Page H1 / document title for a settings tab — matches the active section,
 * never the hub label「设置」/「Settings」.
 */
export function resolveSettingsPageHeading(
  copy: SettingsCopy,
  tab: SettingsTab,
): { description: string; title: string } {
  switch (tab) {
    case "profile":
      return {
        description: copy.profile.editProfileDescription,
        title: copy.profile.editProfile,
      };
    case "preferences":
      return {
        description: copy.settings.preferences.description,
        title: copy.settings.preferences.title,
      };
    case "accounts":
      return {
        description: copy.profile.linkedAccountsDescription,
        title: copy.profile.linkedAccounts,
      };
    case "security":
      return {
        description: copy.settings.security.description,
        title: copy.settings.security.title,
      };
    case "authorizations":
      return {
        description: copy.settings.authorizations.description,
        title: copy.settings.authorizations.title,
      };
    case "danger":
      return {
        description: copy.settings.nav.danger.description,
        title: copy.settings.nav.danger.title,
      };
  }
}
