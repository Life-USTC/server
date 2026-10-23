import AppWindowIcon from "@lucide/svelte/icons/app-window";
import BellIcon from "@lucide/svelte/icons/bell";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BookmarkCheckIcon from "@lucide/svelte/icons/bookmark-check";
import BotIcon from "@lucide/svelte/icons/bot";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import CableIcon from "@lucide/svelte/icons/cable";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import CircleUserIcon from "@lucide/svelte/icons/circle-user";
import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
import CloudSunIcon from "@lucide/svelte/icons/cloud-sun";
import FilesIcon from "@lucide/svelte/icons/files";
import GavelIcon from "@lucide/svelte/icons/gavel";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import LandmarkIcon from "@lucide/svelte/icons/landmark";
import LibraryBigIcon from "@lucide/svelte/icons/library-big";
import LinkIcon from "@lucide/svelte/icons/link";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
import MapIcon from "@lucide/svelte/icons/map";
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import PartyPopperIcon from "@lucide/svelte/icons/party-popper";
import RouteIcon from "@lucide/svelte/icons/route";
import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
import SettingsIcon from "@lucide/svelte/icons/settings";
import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import SunriseIcon from "@lucide/svelte/icons/sunrise";
import TerminalIcon from "@lucide/svelte/icons/terminal";
import UserCogIcon from "@lucide/svelte/icons/user-cog";
import UsersIcon from "@lucide/svelte/icons/users";
import WrenchIcon from "@lucide/svelte/icons/wrench";
import type { Component } from "svelte";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import type { WorkspaceNavigationSummary } from "#lib/shell/shell-bootstrap.js";
import {
  currentCatalogDetailItem,
  currentNewsItem,
  type ShellCatalogCollection,
} from "./shell-nav-helpers";
import type { ShellLink, ShellNavGroup } from "./types";

export type ShellFeatureId = keyof LayoutCopy["nav"]["hub"]["descriptions"];

export type ShellNavGroupId = keyof LayoutCopy["nav"]["groups"];

export type ShellFeature = ShellLink & {
  description: string;
  id: ShellFeatureId;
};

export type ShellFeatureGroup = {
  features: ShellFeature[];
  id: ShellNavGroupId;
  label: string;
};

export type ShellNavViewer = {
  isAdmin: boolean;
  signedIn: boolean;
} | null;

type FeatureDefinition = Omit<ShellFeature, "description" | "label"> & {
  audience?: "user";
  label: (copy: LayoutCopy["nav"]) => string;
};

const BADGES: Partial<
  Record<ShellFeatureId, keyof Omit<WorkspaceNavigationSummary, "userId">>
> = {
  activityNotifications: "unreadActivityNotificationsCount",
  calendar: "calendarItemsCount",
  exams: "examsCount",
  homeworks: "pendingHomeworksCount",
  subscriptions: "subscribedSectionCount",
  todos: "pendingTodosCount",
};

const ACTIVITY_ROOT = "/workspace/subscriptions/activities";

/**
 * First-level groups carry their own icon so the group row reads like the
 * destination rows it opens, instead of a label that happens to be clickable.
 */
const GROUP_ICONS: Record<ShellNavGroupId, Component> = {
  account: CircleUserIcon,
  activities: PartyPopperIcon,
  admin: WrenchIcon,
  apps: AppWindowIcon,
  campus: LandmarkIcon,
  courses: LibraryBigIcon,
  day: SunriseIcon,
};

const GROUPS: ReadonlyArray<{
  audience: "public" | "user" | "admin";
  features: readonly FeatureDefinition[];
  id: ShellNavGroupId;
}> = [
  {
    audience: "user",
    id: "day",
    features: [
      {
        href: "/workspace/calendar",
        icon: CalendarDaysIcon,
        id: "calendar",
        label: (nav) => nav.calendar,
      },
      {
        href: "/workspace/homeworks",
        icon: ClipboardCheckIcon,
        id: "homeworks",
        label: (nav) => nav.homeworks,
      },
      {
        href: "/workspace/todos",
        icon: ListTodoIcon,
        id: "todos",
        label: (nav) => nav.todos,
      },
      {
        href: "/workspace/exams",
        icon: GraduationCapIcon,
        id: "exams",
        label: (nav) => nav.exams,
      },
    ],
  },
  {
    audience: "public",
    id: "courses",
    features: [
      {
        audience: "user",
        href: "/workspace/subscriptions",
        icon: BookmarkCheckIcon,
        id: "subscriptions",
        label: (nav) => nav.subscriptions,
      },
      {
        href: "/catalog/sections",
        icon: RouteIcon,
        id: "sections",
        label: (nav) => nav.sections,
      },
      {
        href: "/catalog/courses",
        icon: BookOpenIcon,
        id: "courses",
        label: (nav) => nav.courses,
      },
      {
        href: "/catalog/teachers",
        icon: UsersIcon,
        id: "teachers",
        label: (nav) => nav.teachers,
      },
    ],
  },
  {
    audience: "public",
    id: "campus",
    features: [
      {
        href: "/catalog/bus",
        icon: BusFrontIcon,
        id: "bus",
        label: (nav) => nav.bus,
      },
      {
        href: "/catalog/weather",
        icon: CloudSunIcon,
        id: "weather",
        label: (nav) => nav.weather,
      },
      {
        href: "/news",
        icon: ScrollTextIcon,
        id: "news",
        label: (nav) => nav.news,
      },
      {
        href: "/catalog/links",
        icon: LinkIcon,
        id: "links",
        label: (nav) => nav.links,
      },
      {
        href: "/catalog/rooms",
        icon: MapPinnedIcon,
        id: "rooms",
        label: (nav) => nav.rooms,
      },
    ],
  },
  {
    audience: "public",
    id: "activities",
    features: [
      {
        href: "/catalog/young-events",
        icon: SparklesIcon,
        id: "youngEvents",
        label: (nav) => nav.youngEvents,
      },
      {
        audience: "user",
        href: `${ACTIVITY_ROOT}?view=notifications`,
        icon: BellIcon,
        id: "activityNotifications",
        label: (nav) => nav.activityNotifications,
      },
    ],
  },
  {
    audience: "user",
    id: "account",
    features: [
      {
        href: "/workspace/uploads",
        icon: FilesIcon,
        id: "uploads",
        label: (nav) => nav.uploads,
      },
      {
        href: "/account/settings/profile",
        icon: SettingsIcon,
        id: "settings",
        label: (nav) => nav.settings,
      },
    ],
  },
  {
    audience: "public",
    id: "apps",
    features: [
      {
        href: "/usage/mobile",
        icon: SmartphoneIcon,
        id: "mobileApp",
        label: (nav) => nav.mobileApp,
      },
      {
        href: "/usage/bot",
        icon: BotIcon,
        id: "prestoBot",
        label: (nav) => nav.prestoBot,
      },
      {
        href: "/usage/mcp",
        icon: CableIcon,
        id: "mcp",
        label: (nav) => nav.mcp,
      },
      {
        href: "/usage/cli",
        icon: TerminalIcon,
        id: "cli",
        label: (nav) => nav.cli,
      },
    ],
  },
  {
    audience: "admin",
    id: "admin",
    features: [
      {
        href: "/admin/users",
        icon: UserCogIcon,
        id: "adminUsers",
        label: (nav) => nav.admin.users,
      },
      {
        href: "/admin/moderation",
        icon: GavelIcon,
        id: "adminModeration",
        label: (nav) => nav.admin.moderation,
      },
      {
        glyph: "key",
        href: "/admin/oauth",
        id: "adminOauth",
        label: (nav) => nav.admin.oauth,
      },
      {
        href: "/admin/bus",
        icon: BusFrontIcon,
        id: "adminBus",
        label: (nav) => nav.admin.bus,
      },
    ],
  },
];

function canSee(
  audience: (typeof GROUPS)[number]["audience"],
  viewer: ShellNavViewer,
) {
  if (audience === "public") return true;
  if (audience === "user") return Boolean(viewer?.signedIn);
  return Boolean(viewer?.signedIn && viewer.isAdmin);
}

/**
 * The one list of product destinations. The desktop sidebar, the mobile
 * drawer, the admin sidebar and the feature hub all render from it.
 */
export function buildShellFeatureGroups(
  copy: LayoutCopy,
  viewer: ShellNavViewer,
  navigation: WorkspaceNavigationSummary | null = null,
): ShellFeatureGroup[] {
  return GROUPS.filter((group) => canSee(group.audience, viewer)).map(
    (group) => ({
      id: group.id,
      label: copy.nav.groups[group.id],
      features: group.features
        .filter((feature) => canSee(feature.audience ?? group.audience, viewer))
        .map(({ label, audience: _audience, ...feature }) => {
          const badgeKey = BADGES[feature.id];
          const text = label(copy.nav);
          const entry = {
            ...feature,
            ...(badgeKey
              ? { ariaLabel: text, badge: navigation?.[badgeKey] }
              : {}),
            description: copy.nav.hub.descriptions[feature.id],
            label: text,
          };
          return {
            ...entry,
            items: sidebarItems(entry, copy, {
              navigation,
              pageData: {},
              pathname: "",
            }),
          };
        }),
    }),
  );
}

type SidebarContext = {
  navigation: WorkspaceNavigationSummary | null;
  pageData: Record<string, unknown>;
  pathname: string;
};

function sidebarItems(
  feature: ShellFeature,
  copy: LayoutCopy,
  { pageData, pathname }: SidebarContext,
): ShellLink[] | undefined {
  const items: Array<ShellLink | null> = [];
  switch (feature.id) {
    case "courses":
    case "sections":
    case "teachers":
      items.push(
        currentCatalogDetailItem(
          feature.href as ShellCatalogCollection,
          pathname,
          pageData,
        ),
      );
      break;
    case "bus":
      items.push({
        href: "/catalog/bus/map",
        icon: MapIcon,
        label: copy.nav.transitMap,
      });
      break;
    case "settings":
      items.push(...buildSettingsNavGroups(copy)[0].links);
      break;
    case "youngEvents":
      items.push(...buildYoungNavGroups(copy, "", {})[0].links.slice(1));
      break;
    case "news":
      items.push(
        { href: "/news/sources", label: copy.nav.newsSources },
        currentNewsItem(pathname, pageData),
      );
      break;
    case "activityNotifications":
      items.push(
        {
          href: `${ACTIVITY_ROOT}?view=events`,
          label: copy.nav.activityViews.events,
        },
        {
          href: `${ACTIVITY_ROOT}?view=organizers`,
          label: copy.nav.activityViews.organizers,
        },
        {
          href: `${ACTIVITY_ROOT}?view=notifications`,
          label: copy.nav.activityViews.notifications,
        },
      );
      break;
    case "adminModeration":
      for (const queue of [
        "comments",
        "descriptions",
        "homeworks",
        "suspensions",
      ] as const)
        items.push({
          href: `/admin/moderation?tab=${queue}`,
          label: copy.nav.admin.queues[queue],
        });
      break;
  }
  const present = items.filter((item): item is ShellLink => item !== null);
  return present.length > 0 ? present : undefined;
}

function toSidebarLink(
  feature: ShellFeature,
  copy: LayoutCopy,
  context: SidebarContext,
): ShellLink {
  const { description: _description, id: _id, ...link } = feature;
  return { ...link, items: sidebarItems(feature, copy, context) };
}

export function buildShellNavGroups(
  copy: LayoutCopy,
  viewer: ShellNavViewer,
  context: SidebarContext,
): ShellNavGroup[] {
  return buildShellFeatureGroups(copy, viewer, context.navigation).map(
    (group) => ({
      defaultOpen:
        group.id === "apps" ? !viewer?.signedIn : group.id !== "admin",
      icon: GROUP_ICONS[group.id],
      label: group.label,
      links: group.features.map((feature) =>
        toSidebarLink(feature, copy, context),
      ),
    }),
  );
}

export function buildAdminNavGroups(
  copy: LayoutCopy,
  viewer: ShellNavViewer,
  context: SidebarContext,
): ShellNavGroup[] {
  const admin = buildShellFeatureGroups(copy, viewer).find(
    (group) => group.id === "admin",
  );
  if (!admin) return [];
  return [
    {
      defaultOpen: true,
      icon: GROUP_ICONS.admin,
      label: admin.label,
      links: admin.features.map((feature) =>
        toSidebarLink(feature, copy, context),
      ),
    },
  ];
}

function youngEventSidebarItem(
  pathname: string,
  pageData: Record<string, unknown>,
): ShellLink | null {
  const match = pathname.match(/^\/catalog\/young-events\/([^/]+)$/);
  if (!match || match[1] === "calendar" || match[1] === "organizers")
    return null;
  const event = pageData.event;
  if (!event || typeof event !== "object") return null;
  const record = event as { name?: unknown; youngId?: unknown };
  if (typeof record.name !== "string" || record.name.trim() === "") return null;
  if (typeof record.youngId === "string" && record.youngId !== match[1])
    return null;
  return { href: pathname, label: record.name.trim() };
}

export function buildYoungNavGroups(
  copy: LayoutCopy,
  pathname: string,
  pageData: Record<string, unknown>,
): ShellNavGroup[] {
  const currentEvent = youngEventSidebarItem(pathname, pageData);
  return [
    {
      defaultOpen: true,
      icon: PartyPopperIcon,
      label: copy.nav.youngEvents,
      links: [
        {
          href: "/catalog/young-events",
          icon: SparklesIcon,
          items: currentEvent ? [currentEvent] : undefined,
          label: copy.nav.youngActivities,
        },
        {
          href: "/catalog/young-events/calendar",
          icon: CalendarDaysIcon,
          label: copy.nav.youngCalendar,
        },
        {
          href: "/catalog/young-events/organizers",
          icon: UsersIcon,
          label: copy.nav.youngOrganizers,
        },
      ],
    },
  ];
}

export function buildSettingsNavGroups(copy: LayoutCopy): ShellNavGroup[] {
  return [
    {
      defaultOpen: true,
      icon: SettingsIcon,
      label: copy.nav.settings,
      links: [
        {
          href: "/account/settings/profile",
          glyph: "profile",
          label: copy.nav.settingsSections.profile,
        },
        {
          href: "/account/settings/preferences",
          glyph: "preferences",
          label: copy.nav.settingsSections.preferences,
        },
        {
          href: "/account/settings/accounts",
          glyph: "accounts",
          label: copy.nav.settingsSections.accounts,
        },
        {
          href: "/account/settings/security",
          icon: ShieldCheckIcon,
          label: copy.nav.settingsSections.security,
        },
        {
          href: "/account/settings/authorizations",
          glyph: "key",
          label: copy.nav.settingsSections.authorizations,
        },
        {
          href: "/account/settings/danger",
          glyph: "danger",
          label: copy.nav.settingsSections.danger,
        },
      ],
    },
  ];
}

type NavigationUrl = Pick<URL, "origin" | "pathname"> & {
  searchParams: Pick<URLSearchParams, "get">;
};

function queryLinkMatches(target: URL, current: NavigationUrl) {
  if (target.searchParams.size === 0) return false;
  if (current.pathname !== target.pathname) return false;
  for (const [key, value] of target.searchParams) {
    const actual = current.searchParams.get(key);
    if (actual === value) continue;
    if (
      actual == null &&
      key === "tab" &&
      value === "comments" &&
      target.pathname === "/admin/moderation"
    ) {
      continue;
    }
    if (
      actual == null &&
      key === "view" &&
      value === "events" &&
      target.pathname === "/workspace/subscriptions/activities"
    ) {
      continue;
    }
    return false;
  }
  return true;
}

export function isShellLinkActive(link: ShellLink, current: NavigationUrl) {
  if (!link.href.startsWith("/")) return false;
  const target = new URL(link.href, current.origin);
  const pathname = current.pathname;

  if (target.searchParams.size > 0) return queryLinkMatches(target, current);

  if (target.pathname === "/news") {
    return pathname === "/news" || pathname.startsWith("/news/");
  }
  if (target.pathname.startsWith("/workspace/")) {
    return pathname === target.pathname;
  }
  if (target.pathname === "/catalog/young-events") {
    const eventId = pathname.startsWith("/catalog/young-events/")
      ? pathname.slice("/catalog/young-events/".length).split("/")[0]
      : "";

    return (
      pathname === "/catalog/young-events" ||
      (eventId.length > 0 && eventId !== "calendar" && eventId !== "organizers")
    );
  }

  if (
    target.pathname === "/catalog/young-events/calendar" ||
    target.pathname === "/catalog/young-events/organizers"
  ) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  if (
    [
      "/catalog/courses",
      "/catalog/sections",
      "/catalog/teachers",
      "/catalog/rooms",
    ].includes(target.pathname)
  ) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  if (target.pathname === "/account/settings/profile") {
    return (
      pathname === "/account/settings" ||
      pathname === "/account/settings/profile"
    );
  }
  if (target.pathname.startsWith("/account/settings/")) {
    return pathname === target.pathname;
  }
  if (target.pathname.startsWith("/admin/")) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  return pathname === target.pathname;
}

/**
 * True when the current page sits below `link` in the URL hierarchy without
 * being the link's own destination, as `/workspace/subscriptions/activities`
 * sits below `/workspace/subscriptions`. Workspace and settings destinations
 * match exactly, so without this a URL child leaves its parent looking
 * unrelated to the page the viewer is on. Only ever one of
 * `isShellLinkActive` and `isShellLinkAncestor` holds for a link, which keeps
 * the single current destination of the sidebar intact.
 */
export function isShellLinkAncestor(link: ShellLink, current: NavigationUrl) {
  if (!link.href.startsWith("/")) return false;
  const target = new URL(link.href, current.origin);
  if (target.searchParams.size > 0) return false;
  if (isShellLinkActive(link, current)) return false;
  return current.pathname.startsWith(`${target.pathname}/`);
}
