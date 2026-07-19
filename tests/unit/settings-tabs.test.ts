import { describe, expect, it } from "vitest";
import {
  isSettingsTab,
  normalizeSettingsTab,
  SETTINGS_TABS,
  settingsTabCompatibilityRedirectHref,
} from "@/features/settings/lib/settings-tabs";

describe("settings tabs", () => {
  it("treats preferences as a semantic settings section", () => {
    expect(SETTINGS_TABS).toContain("preferences");
    expect(isSettingsTab("preferences")).toBe(true);
    expect(normalizeSettingsTab("preferences")).toBe("preferences");
  });

  it("keeps profile as the default for missing or invalid sections", () => {
    expect(normalizeSettingsTab(undefined)).toBe("profile");
    expect(normalizeSettingsTab("not-a-section")).toBe("profile");
  });

  it.each([
    ["profile", "/settings/profile"],
    ["accounts", "/settings/accounts"],
    ["content", "/settings/content"],
    ["danger", "/settings/danger"],
    ["preferences", "/settings/preferences"],
    ["appearance", "/settings/preferences"],
    ["language", "/settings/preferences"],
  ])("redirects legacy %s tabs to %s", (tab, expected) => {
    const url = new URL(
      `https://example.test/settings?tab=${tab}&message=Success`,
    );

    expect(settingsTabCompatibilityRedirectHref(url)).toBe(
      `${expected}?message=Success`,
    );
  });

  it("uses profile for the settings root and unknown tabs", () => {
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/settings"),
      ),
    ).toBe("/settings/profile");
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/settings?tab=unknown&view=compact"),
      ),
    ).toBe("/settings/profile?view=compact");
  });

  it("supports HEAD without redirecting mutations or semantic paths", () => {
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/settings?tab=accounts"),
        "HEAD",
      ),
    ).toBe("/settings/accounts");
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/settings?tab=accounts"),
        "POST",
      ),
    ).toBeNull();
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/settings/profile?tab=accounts"),
      ),
    ).toBeNull();
  });
});
