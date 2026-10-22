import { semanticSectionCompatibilityHref } from "@/lib/navigation/semantic-section-redirect";

export const SETTINGS_TABS = [
  "profile",
  "preferences",
  "accounts",
  "security",
  "authorizations",
  "danger",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/**
 * Tabs whose groups are short and bounded enough to share one canvas. Each of
 * these routes renders the whole set once the viewport is wide enough for a
 * second column — its own group in the leading column, the others beside it —
 * so a wide viewport reads more than one group without navigating, while a
 * narrow one still gets exactly one group per screen.
 *
 * `security` and `authorizations` stay single-group: both render a list whose
 * height grows with the user's own history, so the canvas they need is their
 * own. `danger` stays single-group because ui.settings-navigation-7 keeps
 * destructive controls out of routine destinations.
 */
const SETTINGS_DESKTOP_GROUP = [
  "profile",
  "preferences",
  "accounts",
] as const satisfies readonly SettingsTab[];

type SettingsDesktopGroupTab = (typeof SETTINGS_DESKTOP_GROUP)[number];

const settingsTabSet = new Set<string>(SETTINGS_TABS);
const settingsDesktopGroupSet = new Set<string>(SETTINGS_DESKTOP_GROUP);

/** Groups a settings route renders, active group first. */
export function settingsRenderedTabs(tab: SettingsTab): SettingsTab[] {
  return settingsDesktopGroupSet.has(tab)
    ? [tab, ...SETTINGS_DESKTOP_GROUP.filter((candidate) => candidate !== tab)]
    : [tab];
}

/** Groups shown beside the active one on a wide canvas; empty for single-group routes. */
export function settingsCompanionTabs(
  tab: SettingsTab,
): SettingsDesktopGroupTab[] {
  return settingsDesktopGroupSet.has(tab)
    ? SETTINGS_DESKTOP_GROUP.filter((candidate) => candidate !== tab)
    : [];
}

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
  if (value === "content") {
    return "profile";
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
