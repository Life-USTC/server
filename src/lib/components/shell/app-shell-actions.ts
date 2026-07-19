import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";
import {
  applyShellTheme,
  nextShellThemeMode,
  type ThemeMode,
} from "@/lib/components/shell/layout-shell";

export const SHELL_THEME_CHANGE_EVENT = "life-ustc-theme-change";

export function loadStoredThemeMode(fallback: ThemeMode): ThemeMode {
  const storedTheme = getLocalStorageItem("life-ustc-theme");
  return storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
    ? storedTheme
    : fallback;
}

export function cycleStoredThemeMode(themeMode: ThemeMode) {
  const nextThemeMode = nextShellThemeMode(themeMode);
  setLocalStorageItem("life-ustc-theme", nextThemeMode);
  applyShellTheme(nextThemeMode);
  return nextThemeMode;
}

export function setStoredThemeMode(themeMode: ThemeMode) {
  setLocalStorageItem("life-ustc-theme", themeMode);
  applyShellTheme(themeMode);
  window.dispatchEvent?.(
    new CustomEvent<ThemeMode>(SHELL_THEME_CHANGE_EVENT, {
      detail: themeMode,
    }),
  );
  return themeMode;
}
