import { describe, expect, test, vi } from "vitest";
import { filterShellFeatures } from "@/lib/components/shell/feature-search";
import {
  buildAdminNavGroups,
  buildSettingsNavGroups,
  buildShellFeatureGroups,
  buildShellNavGroups,
  buildYoungNavGroups,
  isShellLinkActive,
} from "@/lib/components/shell/navigation";
import type { ShellLink } from "@/lib/components/shell/types";
import { buildLayoutCopy } from "@/lib/shell/layout-server-data";

const copy = buildLayoutCopy("en-us");
const user = { signedIn: true, isAdmin: false };
const admin = { signedIn: true, isAdmin: true };
const context = {
  pathname: "/workspace/calendar",
  pageData: {},
  navigation: null,
};
function destinations(groups: ReturnType<typeof buildShellFeatureGroups>) {
  return groups.flatMap((group) =>
    group.features.map((feature) => feature.href),
  );
}
function activeLinks(links: ShellLink[], path: string): ShellLink[] {
  const current = new URL(path, "https://life.example");
  return links.flatMap((link) => {
    const children = activeLinks(link.items ?? [], path);
    return children.length
      ? children
      : isShellLinkActive(link, current)
        ? [link]
        : [];
  });
}

describe("shared functional shell navigation", () => {
  test.each(["en-us", "zh-cn"] as const)(
    "uses one role-filtered model in %s",
    (locale) => {
      const localized = buildLayoutCopy(locale);
      expect(
        buildShellFeatureGroups(localized, null).map((group) => group.id),
      ).toEqual(["courses", "campus", "activities", "apps"]);
      expect(
        buildShellFeatureGroups(localized, user).map((group) => group.id),
      ).toEqual(["day", "courses", "campus", "activities", "account", "apps"]);
      expect(
        destinations(
          buildShellFeatureGroups(localized, {
            signedIn: false,
            isAdmin: true,
          }),
        ),
      ).not.toContain("/admin/users");
      for (const viewer of [null, user, admin]) {
        const hub = buildShellFeatureGroups(localized, viewer);
        const sidebar = buildShellNavGroups(localized, viewer, context);
        expect(
          sidebar.flatMap((group) => group.links.map((link) => link.href)),
        ).toEqual(destinations(hub));
        expect(destinations(hub)).not.toContain("/terms");
        expect(destinations(hub)).not.toContain("/privacy");
        expect(
          sidebar
            .flatMap((group) => group.links)
            .find((link) => link.href === "/catalog/sections")?.items,
        ).toBeUndefined();
      }
    },
  );

  test.each(["en-us", "zh-cn"] as const)(
    "combines manage and discover destinations in %s",
    (locale) => {
      const localized = buildLayoutCopy(locale);
      for (const viewer of [null, user, admin]) {
        const groups = buildShellFeatureGroups(localized, viewer);
        expect(
          groups
            .find((group) => group.id === "courses")
            ?.features.map((feature) => feature.href),
        ).toEqual([
          ...(viewer ? ["/workspace/subscriptions"] : []),
          "/catalog/courses",
          "/catalog/sections",
          "/catalog/teachers",
        ]);
        const activities = groups.find((group) => group.id === "activities");
        expect(activities).toBeDefined();
        expect(activities?.features.map((feature) => feature.href)).toEqual([
          "/catalog/young-events",
          ...(viewer
            ? ["/workspace/subscriptions/activities?view=notifications"]
            : []),
        ]);
        expect(activities?.features[0].items?.map((item) => item.href)).toEqual(
          [
            "/catalog/young-events/calendar",
            "/catalog/young-events/organizers",
          ],
        );
        expect(
          groups
            .find((group) => group.id === "campus")
            ?.features.map((feature) => feature.href),
        ).toEqual([
          "/catalog/bus",
          "/catalog/weather",
          "/news",
          "/catalog/links",
          "/catalog/rooms",
        ]);
        expect(
          buildShellNavGroups(localized, viewer, context).map(
            (group) => group.label,
          ),
        ).toEqual(groups.map((group) => group.label));
      }
      expect(
        buildShellFeatureGroups(localized, user)
          .find((group) => group.id === "courses")
          ?.features.map((feature) => feature.label),
      ).toEqual(
        locale === "zh-cn"
          ? ["我的教学班", "浏览课程", "浏览班级", "教师"]
          : ["My sections", "Browse courses", "Browse sections", "Teachers"],
      );
    },
  );

  test("keeps badges with their actual destinations", () => {
    const navigation = {
      userId: "user",
      calendarItemsCount: 8,
      examsCount: 2,
      pendingHomeworksCount: 3,
      pendingTodosCount: 4,
      subscribedSectionCount: 5,
      unreadActivityNotificationsCount: 6,
    };
    const links = buildShellNavGroups(copy, user, {
      ...context,
      navigation,
    }).flatMap((group) => group.links);
    expect(
      links
        .filter((link) => link.badge != null)
        .map((link) => [link.href, link.badge]),
    ).toEqual([
      ["/workspace/calendar", 8],
      ["/workspace/homeworks", 3],
      ["/workspace/todos", 4],
      ["/workspace/exams", 2],
      ["/workspace/subscriptions", 5],
      ["/workspace/subscriptions/activities?view=notifications", 6],
    ]);
  });

  test.each([
    ["/catalog/courses/12", { course: { namePrimary: "Course" } }],
    [
      "/catalog/sections/12",
      { section: { course: { namePrimary: "Course" } } },
    ],
    ["/catalog/teachers/12", { teacher: { namePrimary: "Teacher" } }],
    [
      "/news/article",
      { publication: { id: "article", revision: { title: "News" } } },
    ],
    ["/news/sources", {}],
    ["/catalog/bus/map", {}],
    ["/workspace/todos", {}],
    ["/workspace/subscriptions/activities?view=notifications", {}],
    ["/workspace/subscriptions/activities", {}],
  ])("identifies one current destination for %s", (path, pageData) => {
    const pathname = path.split("?")[0];
    const links = buildShellNavGroups(copy, user, {
      ...context,
      pathname,
      pageData,
    }).flatMap((group) => group.links);
    const active = activeLinks(links, path);
    expect(active).toHaveLength(1);
    expect(active[0].href).toBe(
      path === "/workspace/subscriptions/activities"
        ? `${path}?view=events`
        : path,
    );
  });

  test("admin and contextual sidebars preserve unique current links", () => {
    expect(buildAdminNavGroups(copy, user, context)).toEqual([]);
    const links = buildAdminNavGroups(copy, admin, context).flatMap(
      (group) => group.links,
    );
    expect(links.map((link) => link.href)).toEqual([
      "/admin/users",
      "/admin/moderation",
      "/admin/oauth",
      "/admin/bus",
    ]);
    for (const tab of [
      "comments",
      "descriptions",
      "homeworks",
      "suspensions",
    ]) {
      expect(activeLinks(links, `/admin/moderation?tab=${tab}`)).toHaveLength(
        1,
      );
    }
    expect(activeLinks(links, "/admin/moderation")[0].href).toBe(
      "/admin/moderation?tab=comments",
    );
    const settings = buildSettingsNavGroups(copy)[0].links;
    expect(activeLinks(settings, "/account/settings/security")[0].href).toBe(
      "/account/settings/security",
    );
    const young = buildYoungNavGroups(copy, "/catalog/young-events/123", {
      event: { name: "Event", youngId: "123" },
    })[0].links;
    expect(activeLinks(young, "/catalog/young-events/123")[0].label).toBe(
      "Event",
    );
    expect(
      activeLinks(young, "/catalog/young-events/organizers/example")[0].href,
    ).toBe("/catalog/young-events/organizers");
  });

  test("searches names, descriptions, group labels and child destinations, and clears", () => {
    const groups = buildShellFeatureGroups(copy, user);
    expect(
      destinations(filterShellFeatures(groups, "  HOMEWORK   progress ")),
    ).toEqual(["/workspace/homeworks"]);
    expect(destinations(filterShellFeatures(groups, "Campus"))).toEqual([
      "/catalog/bus",
      "/catalog/weather",
      "/news",
      "/catalog/links",
      "/catalog/rooms",
    ]);
    expect(
      destinations(filterShellFeatures(groups, "/account/settings/security")),
    ).toEqual(["/account/settings/profile"]);
    expect(filterShellFeatures(groups, "no-such-feature")).toEqual([]);
    expect(filterShellFeatures(groups, "  ")).toBe(groups);
    expect(
      destinations(
        filterShellFeatures(
          buildShellFeatureGroups(buildLayoutCopy("zh-cn"), null),
          "时刻表",
        ),
      ),
    ).toEqual(["/catalog/bus"]);
  });
});

// Icon rendering is covered by browser tests; the Node suite checks navigation data.
vi.mock("@lucide/svelte/icons/bell", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/book-open", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bookmark-check", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bot", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bus-front", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/cable", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/calendar-days", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/clipboard-check", () => ({
  default: () => null,
}));
vi.mock("@lucide/svelte/icons/cloud-sun", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/files", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/gavel", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/graduation-cap", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/house", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/link", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/list-todo", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/map", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/map-pinned", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/route", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/scroll-text", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/settings", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/shield-check", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/smartphone", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/sparkles", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/terminal", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/user-cog", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/users", () => ({ default: () => null }));
