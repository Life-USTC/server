import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import LandmarkIcon from "@lucide/svelte/icons/landmark";
import PartyPopperIcon from "@lucide/svelte/icons/party-popper";
import SunriseIcon from "@lucide/svelte/icons/sunrise";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { detailNavigation } from "./detail-navigation";
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
  /** Immediate rows shown beneath this directory in its parent sidebar. */
  previewLinks?: ShellLink[];
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

/** Match only an immediate owned directory; personal and admin aliases stay explicit. */
export function navigationScopeForLink(
  scopes: Record<string, NavigationScope>,
  scopeId: string,
  link: ShellLink,
): NavigationScope | undefined {
  const id =
    link.id === "activityNotifications"
      ? "activity-workspace"
      : link.id === "adminModeration"
        ? "admin-queues"
        : link.id;
  const child = id ? scopes[id] : undefined;
  return child?.parent === scopeId ? child : undefined;
}

/** The next visible level omits the collection already represented by its parent row. */
export function navigationScopeChildren(
  scopes: Record<string, NavigationScope>,
  scopeId: string,
  link: ShellLink,
): ShellLink[] {
  const child = navigationScopeForLink(scopes, scopeId, link);
  const links =
    child?.previewLinks ??
    child?.groups.flatMap((group) => group.links) ??
    link.items ??
    [];
  return directoryRows(links).filter(
    (candidate) => candidate.href !== link.href,
  );
}

/** Leaf pages retain the nearest directory with actual choices, rather than a lone duplicate. */
export function displayNavigationScope(
  scopes: Record<string, NavigationScope>,
  current: string,
): string {
  let scope = scopes[current] ?? scopes.root;
  const visited = new Set<string>();
  while (scope.parent && !visited.has(scope.id)) {
    visited.add(scope.id);
    const parent = scopes[scope.parent];
    if (!parent) break;
    const owner = parent.groups
      .flatMap((group) => group.links)
      .find(
        (link) => navigationScopeForLink(scopes, parent.id, link) === scope,
      );
    if (owner) {
      if (navigationScopeChildren(scopes, parent.id, owner).length) break;
    } else {
      const links = scope.groups.flatMap((group) => group.links);
      if (
        links.length > 1 ||
        links.some(
          (link) => navigationScopeChildren(scopes, scope.id, link).length,
        )
      )
        break;
    }
    scope = parent;
  }
  return scope.id;
}

/** Collections remain available; a deeper entity or matching query row owns page current. */
export function isCurrentScopeLink(
  link: ShellLink,
  links: readonly ShellLink[],
  isActive: (link: ShellLink) => boolean,
) {
  if (!isActive(link)) return false;
  const target = new URL(link.href, "https://navigation.invalid");
  const path = target.pathname;
  return !links.some((candidate) => {
    if (candidate.href === link.href || !isActive(candidate)) return false;
    const child = new URL(candidate.href, "https://navigation.invalid");
    if (child.pathname === path)
      return (
        (!target.hash && Boolean(candidate.detail)) ||
        (target.searchParams.size === 0 && child.searchParams.size > 0)
      );
    return child.pathname.startsWith(`${path.replace(/\/$/, "")}/`);
  });
}

/** Copy at most one child level, without carrying deeper subtrees into the preview. */
function directoryRows(
  links: ShellLink[],
  includeChildren = false,
): ShellLink[] {
  const seen = new Set<string>();
  const result: ShellLink[] = [];
  function add(link: ShellLink, inheritedIcon?: ShellLink["icon"]) {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    const { items: _items, ...own } = link;
    const icon = link.glyph ? undefined : (link.icon ?? inheritedIcon);
    result.push({ ...own, icon });
  }
  for (const link of links) {
    add(link);
    if (includeChildren)
      for (const child of link.items ?? []) add(child, link.icon);
  }
  return result;
}

/** Complete feature/search trees stay intact; the sidebar exposes adjacent levels only. */
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
    includeCollectionChildren = false,
  ) => {
    scopes[id] = {
      id,
      label,
      parent,
      groups: [{ id, label, links }],
      previewLinks: directoryRows(links, includeCollectionChildren),
    };
  };
  const primary = buildPrimaryDestinations(copy, viewer, loading);
  const calendar = find("calendar");
  if (calendar && !loading) {
    primary[1] = {
      ...primary[1],
      badge: calendar.badge,
      badgeLabel: calendar.badgeLabel,
    };
  }
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
  const detail = detailNavigation(
    context.pageData,
    context.pathname,
    copy,
    context.search,
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
      if (detail && detail.collection.href === feature.href) {
        add(feature.id, feature.label, "campus", [
          ...(feature.id === "sections"
            ? []
            : [{ ...feature, items: undefined }]),
          { ...detail.current, icon: feature.icon },
        ]);
      } else {
        add(feature.id, feature.label, "campus", [feature], true);
      }
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
  // Both visible levels belong to the same directory. Only destinations
  // beyond the root rows and their immediate children need a local sidebar.
  const primaryId = primaryDestination(path);
  const rootEntry = primary.find((link) => link.id === primaryId);
  if (rootEntry) {
    const visible = [
      rootEntry,
      ...navigationScopeChildren(scopes, "root", rootEntry),
    ];
    if (
      visible.some(
        (link) =>
          new URL(link.href, "https://navigation.invalid").pathname === path,
      )
    )
      current = "root";
  }
  return { current: scopes[current] ? current : "root", scopes, primary };
}
