import { describe, expect, it } from "vitest";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import { resolveSettingsPageHeading } from "@/features/settings/lib/settings-page-heading";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";

describe("resolveSettingsPageHeading", () => {
  it.each(["en-us", "zh-cn"] as const)(
    "uses the active tab title instead of the hub label in %s",
    (locale) => {
      const copy = getSettingsCopy(locale);
      const hub = copy.settings.title;

      for (const tab of [
        "profile",
        "preferences",
        "accounts",
        "security",
        "authorizations",
        "danger",
      ] as const satisfies readonly SettingsTab[]) {
        const heading = resolveSettingsPageHeading(copy, tab);
        expect(heading.title).not.toBe(hub);
        expect(heading.title.length).toBeGreaterThan(0);
        expect(heading.description.length).toBeGreaterThan(0);
      }

      expect(resolveSettingsPageHeading(copy, "profile").title).toBe(
        copy.profile.editProfile,
      );
    },
  );
});
