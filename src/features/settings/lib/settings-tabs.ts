import { semanticSectionCompatibilityHref } from "@/lib/navigation/semantic-section-redirect";

export const SETTINGS_TABS = [
  "profile",
  "preferences",
  "accounts",
  "authorizations",
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

export function settingsTabFromPathname(pathname: string): SettingsTab {
  return normalizeSettingsTab(pathname.split("/").filter(Boolean).at(-1));
}

function resolveLegacySettingsTab(value: string | null) {
  if (value === "appearance" || value === "language") {
    return "preferences";
  }
  return isSettingsTab(value) ? value : null;
}

export function settingsTabCompatibilityRedirectHref(url: URL, method = "GET") {
  return semanticSectionCompatibilityHref({
    basePath: "/account/settings",
    defaultSection: "profile",
    method,
    resolveSection: resolveLegacySettingsTab,
    url,
  });
}
