/** Device-local presentation only: no viewer, counts, labels or record IDs. */
export const SIDEBAR_PREFERENCES_KEY = "life-ustc.sidebar.v1";

export type SidebarPreferences = {
  open?: boolean;
  groups: Record<string, boolean>;
  submenus: Record<string, boolean>;
};

function disclosures(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, open]) =>
        /^[a-z][a-zA-Z0-9-]{0,63}$/.test(key) && typeof open === "boolean",
    ),
  );
}

export function loadSidebarPreferences(): SidebarPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(SIDEBAR_PREFERENCES_KEY) ?? "null",
    );
    return {
      open: typeof value?.open === "boolean" ? value.open : undefined,
      groups: disclosures(value?.groups),
      submenus: disclosures(value?.submenus),
    };
  } catch {
    return { groups: {}, submenus: {} };
  }
}

export function saveSidebarPreferences(preferences: SidebarPreferences): void {
  try {
    localStorage.setItem(
      SIDEBAR_PREFERENCES_KEY,
      JSON.stringify({
        open:
          typeof preferences.open === "boolean" ? preferences.open : undefined,
        groups: disclosures(preferences.groups),
        submenus: disclosures(preferences.submenus),
      }),
    );
  } catch {
    // Storage can be blocked or full; navigation remains usable in memory.
  }
}
