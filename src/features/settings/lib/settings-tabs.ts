export const SETTINGS_TABS = [
  "profile",
  "preferences",
  "accounts",
  "content",
  "danger",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

const settingsTabSet = new Set<string>(SETTINGS_TABS);

export function isSettingsTab(
  value: string | null | undefined,
): value is SettingsTab {
  return Boolean(value && settingsTabSet.has(value));
}

export function normalizeSettingsTab(
  value: string | null | undefined,
): SettingsTab {
  return isSettingsTab(value) ? value : "profile";
}
