import { describe, expect, it } from "vitest";
import {
  isSettingsTab,
  normalizeSettingsTab,
  SETTINGS_TABS,
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
});
