import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import LandmarkIcon from "@lucide/svelte/icons/landmark";
import PartyPopperIcon from "@lucide/svelte/icons/party-popper";
import SunriseIcon from "@lucide/svelte/icons/sunrise";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import {
  buildAdminNavGroups,
  buildSettingsNavGroups,
  buildShellNavGroups,
  buildYoungNavGroups,
  type ShellNavViewer,
} from "./navigation";
import type { ShellLink, ShellNavGroup } from "./types";

type Context = Parameters<typeof buildShellNavGroups>[2];
export type PrimaryDestination =
  | "workspace"
  | "calendar"
  | "campus"
  | "activities";
export type NavigationScope = {
  id: string;
  label: string;
  parent: string | null;
  groups: ShellNavGroup[];
};

/** Exact exceptions precede the personal-workspace and public catalog prefixes. */
export function primaryDestination(
  pathname: string,
): PrimaryDestination | null {
  if (
    pathname === "/workspace/uploads" ||
    pathname.startsWith("/workspace/uploads/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  )
    return null;
  if (pathname === "/workspace/calendar") return "calendar";
  if (
    pathname === "/" ||
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/")
  )
    return "workspace";
  if (
    pathname === "/catalog/young-events" ||
    pathname.startsWith("/catalog/young-events/")
  )
    return "activities";
  if (
    pathname === "/campus" ||
    pathname.startsWith("/catalog/") ||
    pathname === "/news" ||
    pathname.startsWith("/news/")
  )
    return "campus";
  return null;
}

export function buildPrimaryDestinations(
  copy: LayoutCopy,
  viewer: ShellNavViewer,
  loading = false,
): ShellLink[] {
  const labels = copy.shell.primaryDestinations;
  return [
    { id: "workspace", href: "/", icon: SunriseIcon, label: labels.workspace },
    {
      id: "calendar",
      href: viewer?.signedIn
        ? "/workspace/calendar"
        : "/account/sign-in?callbackUrl=%2Fworkspace%2Fcalendar",
      icon: CalendarDaysIcon,
      label: labels.calendar,
      ...(loading ? { disabledReason: copy.shell.loading } : {}),
    },
    { id: "campus", href: "/campus", icon: LandmarkIcon, label: labels.campus },
    {
      id: "activities",
      href: "/catalog/young-events",
      icon: PartyPopperIcon,
      label: labels.activities,
    },
  ];
}

/** A flat directory retains its collection link, but the real entity owns page current. */
export function isCurrentScopeLink(
  link: ShellLink,
  links: readonly ShellLink[],
  isActive: (link: ShellLink) => boolean,
) {
  if (!isActive(link)) return false;
  const path = new URL(link.href, "https://navigation.invalid").pathname;
  return !links.some((candidate) => {
    if (candidate.href === link.href || !isActive(candidate)) return false;
    const child = new URL(candidate.href, "https://navigation.invalid")
      .pathname;
    return child !== path && child.startsWith(`${path.replace(/\/$/, "")}/`);
  });
}

function flat(links: ShellLink[]): ShellLink[] {
  const seen = new Set<string>();
  const result: ShellLink[] = [];
  function add(link: ShellLink, inheritedIcon?: ShellLink["icon"]) {
    if (!seen.has(link.href)) {
      seen.add(link.href);
      const { items, ...own } = link;
      const icon = link.glyph ? undefined : (link.icon ?? inheritedIcon);
      result.push({ ...own, icon });
      for (const item of items ?? []) add(item, icon);
    }
  }
  for (const link of links) add(link);
  return result;
}

/** Complete feature/search trees remain intact; only the selected sidebar level is flat. */
export function buildNavigationScopes(
  copy: LayoutCopy,
  viewer: ShellNavViewer,
  context: Context,
  loading = false,
) {
  const all = buildShellNavGroups(copy, viewer, context);
  const publicGroups = buildShellNavGroups(copy, null, context);
  const find = (id: string) =>
    all.flatMap((g) => g.links).find((link) => link.id === id);
  const scopes: Record<string, NavigationScope> = {};
  const add = (
    id: string,
    label: string,
    parent: string | null,
    links: ShellLink[],
  ) => {
    scopes[id] = {
      id,
      label,
      parent,
      groups: [{ id, label, links: flat(links) }],
    };
  };
  const primary = buildPrimaryDestinations(copy, viewer, loading);
  add("root", copy.shell.primaryNavigation, null, primary);
  add("workspace", copy.shell.primaryDestinations.workspace, "root", [
    { href: "/", label: copy.nav.overview, icon: SunriseIcon },
    ...[
      "homeworks",
      "todos",
      "exams",
      "subscriptions",
      "activityNotifications",
    ].flatMap((id) => {
      const link = find(id);
      return link ? [{ ...link, items: undefined }] : [];
    }),
  ]);
  add("calendar", copy.shell.primaryDestinations.calendar, "root", [
    find("calendar") ?? primary[1],
  ]);
  add(
    "campus",
    copy.shell.primaryDestinations.campus,
    "root",
    publicGroups
      .filter((g) => g.id === "courses" || g.id === "campus")
      .flatMap((g) => g.links.map((link) => ({ ...link, items: undefined }))),
  );
  for (const feature of publicGroups.flatMap((g) => g.links)) {
    if (
      feature.id &&
      [
        "courses",
        "sections",
        "teachers",
        "bus",
        "weather",
        "links",
        "rooms",
        "news",
      ].includes(feature.id)
    )
      add(feature.id, feature.label, "campus", [feature]);
  }
  add(
    "activities",
    copy.shell.primaryDestinations.activities,
    "root",
    buildYoungNavGroups(copy, context.pathname, context.pageData).flatMap(
      (g) => g.links,
    ),
  );
  const notifications = find("activityNotifications");
  if (notifications)
    add(
      "activity-workspace",
      notifications.label,
      "workspace",
      notifications.items?.map((link) => ({
        ...link,
        icon: notifications.icon,
      })) ?? [notifications],
    );
  add(
    "settings",
    copy.nav.settings,
    "root",
    buildSettingsNavGroups(copy).flatMap((g) => g.links),
  );
  const uploads = find("uploads");
  if (uploads) add("uploads", uploads.label, "root", [uploads]);
  add(
    "apps",
    copy.nav.groups.apps,
    "root",
    publicGroups.filter((g) => g.id === "apps").flatMap((g) => g.links),
  );
  if (viewer?.isAdmin) {
    const admin = buildAdminNavGroups(copy, viewer, context).flatMap(
      (g) => g.links,
    );
    add(
      "admin",
      copy.nav.admin.title,
      "root",
      admin.map((link) => ({ ...link, items: undefined })),
    );
    const moderation = admin.find((link) => link.id === "adminModeration");
    if (moderation)
      add(
        "admin-queues",
        moderation.label,
        "admin",
        moderation.items?.map((link) => ({
          ...link,
          icon: moderation.icon,
        })) ?? [moderation],
      );
  }
  const path = context.pathname;
  let current = "root";
  if (path === "/workspace/uploads" || path.startsWith("/workspace/uploads/"))
    current = "uploads";
  else if (
    path === "/account/settings" ||
    path.startsWith("/account/settings/")
  )
    current = "settings";
  else if (path === "/admin" || path.startsWith("/admin/"))
    current = path === "/admin/moderation" ? "admin-queues" : "admin";
  else if (path === "/workspace/calendar") current = "calendar";
  else if (path === "/workspace/subscriptions/activities")
    current = "activity-workspace";
  else if (primaryDestination(path) === "workspace")
    current = viewer?.signedIn ? "workspace" : "root";
  else if (primaryDestination(path) === "activities") current = "activities";
  else if (path.startsWith("/catalog/")) current = path.split("/")[2];
  else if (path === "/news" || path.startsWith("/news/")) current = "news";
  else if (path === "/campus") current = "campus";
  else if (path.startsWith("/usage/")) current = "apps";
  if (
    !viewer?.signedIn &&
    [
      "settings",
      "uploads",
      "activity-workspace",
      "workspace",
      "admin",
      "admin-queues",
    ].includes(current)
  )
    current = "root";
  return { current: scopes[current] ? current : "root", scopes, primary };
}
