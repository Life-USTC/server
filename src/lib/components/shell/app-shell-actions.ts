import {
  applyShellTheme,
  nextShellThemeMode,
  type ThemeMode,
} from "$lib/components/shell/layout-shell";

export function loadStoredThemeMode(fallback: ThemeMode): ThemeMode {
  const storedTheme = localStorage.getItem("life-ustc-theme");
  return storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
    ? storedTheme
    : fallback;
}

export function cycleStoredThemeMode(themeMode: ThemeMode) {
  const nextThemeMode = nextShellThemeMode(themeMode);
  localStorage.setItem("life-ustc-theme", nextThemeMode);
  applyShellTheme(nextThemeMode);
  return nextThemeMode;
}
