import { describe, expect, it } from "vitest";
import {
  isSettingsTab,
  normalizeSettingsTab,
  SETTINGS_TABS,
  settingsTabCompatibilityRedirectHref,
  settingsTabFromPathname,
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

  it("reads the active section from the account settings path", () => {
    expect(settingsTabFromPathname("/account/settings/danger")).toBe("danger");
    expect(settingsTabFromPathname("/account/settings")).toBe("profile");
  });

  it.each([
    ["profile", "/account/settings/profile"],
    ["accounts", "/account/settings/accounts"],
    ["content", "/account/settings/content"],
    ["danger", "/account/settings/danger"],
    ["preferences", "/account/settings/preferences"],
    ["appearance", "/account/settings/preferences"],
    ["language", "/account/settings/preferences"],
  ])("redirects legacy %s tabs to %s", (tab, expected) => {
    const url = new URL(
      `https://example.test/account/settings?tab=${tab}&message=Success`,
    );

    expect(settingsTabCompatibilityRedirectHref(url)).toBe(
      `${expected}?message=Success`,
    );
  });

  it("uses profile for the settings root and unknown tabs", () => {
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/account/settings"),
      ),
    ).toBe("/account/settings/profile");
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL(
          "https://example.test/account/settings?tab=unknown&view=compact",
        ),
      ),
    ).toBe("/account/settings/profile?view=compact");
  });

  it("supports HEAD without redirecting mutations or semantic paths", () => {
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/account/settings?tab=accounts"),
        "HEAD",
      ),
    ).toBe("/account/settings/accounts");
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/account/settings?tab=accounts"),
        "POST",
      ),
    ).toBeNull();
    expect(
      settingsTabCompatibilityRedirectHref(
        new URL("https://example.test/account/settings/profile?tab=accounts"),
      ),
    ).toBeNull();
  });
});
