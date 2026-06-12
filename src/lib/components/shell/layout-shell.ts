import type { ShellLink } from "$lib/components/shell/types";

export type ThemeMode = "system" | "light" | "dark";

type ShellUser = {
  id?: string | null;
  name?: string | null;
  username?: string | null;
} | null;

type NavCopy = {
  courses: string;
  sections: string;
  teachers: string;
};

type FooterCopy = {
  mobileApp: string;
  privacy: string;
  terms: string;
};

type ThemeCopy = {
  switchToDark: string;
  switchToLight: string;
  useSystem: string;
};

export function resolveProfileHref(user: ShellUser) {
  if (user?.username) return `/u/${user.username}`;
  if (user?.id) return `/u/id/${user.id}`;
  return "/";
}

export function resolveAvatarFallback(user: ShellUser) {
  return user?.name?.charAt(0) ?? "U";
}

export function resolveThemeButtonLabel(mode: ThemeMode, copy: ThemeCopy) {
  if (mode === "light") return copy.switchToDark;
  if (mode === "dark") return copy.useSystem;
  return copy.switchToLight;
}

export function buildPrimaryLinks(copy: NavCopy): ShellLink[] {
  return [
    { href: "/courses", label: copy.courses },
    { href: "/sections", label: copy.sections },
    { href: "/teachers", label: copy.teachers },
  ];
}

export function buildFooterLinks(copy: FooterCopy): ShellLink[] {
  return [
    { href: "/terms", label: copy.terms },
    { href: "/privacy", label: copy.privacy },
    {
      href: "https://github.com/Life-USTC/server",
      label: "GitHub",
      rel: "noreferrer",
      target: "_blank",
    },
    { href: "/mobile-app", label: copy.mobileApp },
  ];
}

export function nextShellThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}

export function applyShellTheme(mode: ThemeMode) {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
}
