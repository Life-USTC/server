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

const workspaceRoots = [
  "/admin",
  "/workspace",
  "/account/settings",
  "/account/welcome",
];

function matchesPathRoot(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function isDetailWorkspacePath(pathname: string) {
  return /^\/catalog\/(courses|sections|teachers)\/[^/]+/.test(pathname);
}

export function shouldShowAppFooter(pathname: string, signedIn: boolean) {
  if (isDetailWorkspacePath(pathname)) return false;
  if (workspaceRoots.some((root) => matchesPathRoot(pathname, root))) {
    return false;
  }
  if (signedIn && pathname === "/") return false;
  return true;
}

export function resolveProfileHref(user: ShellUser) {
  if (user?.username) return `/community/users/${user.username}`;
  if (user?.id) return `/community/users/id/${user.id}`;
  return "/";
}

export function resolveAvatarFallback(user: ShellUser) {
  return user?.name?.charAt(0) ?? "U";
}

export function buildPrimaryLinks(copy: NavCopy): ShellLink[] {
  return [
    { href: "/catalog/courses", label: copy.courses },
    { href: "/catalog/sections", label: copy.sections },
    { href: "/catalog/teachers", label: copy.teachers },
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

export function resolveShellTheme(mode: ThemeMode, prefersDark: boolean) {
  return mode === "dark" || (mode === "system" && prefersDark)
    ? "dark"
    : "light";
}

export function applyShellTheme(mode: ThemeMode) {
  const prefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  document.documentElement.dataset.theme = resolveShellTheme(mode, prefersDark);
}
