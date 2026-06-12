import {
  applyShellTheme,
  nextShellThemeMode,
  type ThemeMode,
} from "$lib/components/shell/layout-shell";

type AppLocale = "en-us" | "zh-cn";

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

export async function setShellLocale({
  currentLocale,
  locale,
  onBeforeRequest,
}: {
  currentLocale: AppLocale;
  locale: AppLocale;
  onBeforeRequest: () => void;
}) {
  onBeforeRequest();
  if (locale === currentLocale) return;
  const response = await fetch("/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (response.ok) {
    window.location.reload();
  }
}
