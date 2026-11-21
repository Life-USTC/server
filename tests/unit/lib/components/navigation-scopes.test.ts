import { describe, expect, test, vi } from "vitest";
import { isShellLinkActive } from "@/lib/components/shell/navigation";
import {
  buildNavigationScopes,
  buildPrimaryDestinations,
  displayNavigationScope,
  isCurrentScopeLink,
  type NavigationScope,
  navigationScopeChildren,
  navigationScopeForLink,
  primaryDestination,
} from "@/lib/components/shell/navigation-scopes";
import { buildLayoutCopy } from "@/lib/shell/layout-server-data";

const user = { signedIn: true, isAdmin: false };
const admin = { signedIn: true, isAdmin: true };
const context = {
  pathname: "/catalog/bus/map",
  pageData: {},
  navigation: null,
};
describe("four primary navigation and adjacent owned directories", () => {
  test.each([
    ["/", "workspace"],
    ["/workspace/homeworks", "workspace"],
    ["/workspace/subscriptions", "workspace"],
    ["/workspace/subscriptions/activities", "workspace"],
    ["/workspace/calendar", "calendar"],
    ["/catalog/young-events/calendar", "activities"],
    ["/catalog/young-events/organizers/abc", "activities"],
    ["/catalog/courses/12", "campus"],
    ["/news/sources", "campus"],
    ["/campus", "campus"],
    ["/workspace/uploads", null],
    ["/workspace/uploads/abc", null],
    ["/account/settings/profile", null],
    ["/admin/users", null],
    ["/usage/mobile", null],
    ["/community/users/name", null],
  ] as const)("owns %s as %s", (path, expected) =>
    expect(primaryDestination(path)).toBe(expected),
  );
  test.each([
    "/",
    "/workspace/homeworks",
    "/workspace/todos",
    "/workspace/exams",
    "/workspace/calendar",
    "/campus",
    "/catalog/sections",
    "/catalog/young-events/calendar",
  ])("retains both visible root levels on %s", (pathname) => {
    const { current } = buildNavigationScopes(buildLayoutCopy("en-us"), user, {
      ...context,
      pathname,
    });
    expect(current).toBe("root");
  });
  test.each(["en-us", "zh-cn"] as const)(
    "keeps the four roots and public Campus separate in %s",
    (locale) => {
      const copy = buildLayoutCopy(locale);
      for (const viewer of [null, user, admin]) {
        const model = buildNavigationScopes(copy, viewer, context);
        expect(model.primary.map((link) => link.id)).toEqual([
          "workspace",
          "calendar",
          "campus",
          "activities",
        ]);
        expect(model.scopes.bus.parent).toBe("campus");
        expect(model.scopes.campus.parent).toBe("root");
        expect(model.current).toBe("bus");
        expect(
          model.scopes.campus.groups.flatMap((g) =>
            g.links.map((link) => link.href),
          ),
        ).toEqual([
          "/catalog/sections",
          "/catalog/courses",
          "/catalog/teachers",
          "/catalog/bus",
          "/catalog/weather",
          "/news",
          "/catalog/links",
          "/catalog/rooms",
        ]);
        for (const scope of Object.values(model.scopes))
          for (const link of scope.previewLinks ?? [])
            expect(link.items).toBeUndefined();
        for (const id of ["root", "workspace", "campus"])
          for (const link of model.scopes[id].groups.flatMap(
            (group) => group.links,
          ))
            expect(link.items).toBeUndefined();
        expect(
          model.scopes.workspace.groups.flatMap((g) =>
            g.links.map((link) => link.href),
          ),
        ).toEqual(
          viewer
            ? [
                "/",
                "/workspace/homeworks",
                "/workspace/todos",
                "/workspace/exams",
                "/workspace/subscriptions",
                "/workspace/subscriptions/activities?view=notifications",
              ]
            : ["/"],
        );
        expect(Boolean(model.scopes.admin)).toBe(Boolean(viewer?.isAdmin));
      }
      expect(buildPrimaryDestinations(copy, null)[1].href).toBe(
        "/account/sign-in?callbackUrl=%2Fworkspace%2Fcalendar",
      );
      expect(buildPrimaryDestinations(copy, null, true)[1].disabledReason).toBe(
        copy.shell.loading,
      );
    },
  );
  test.each(["courses", "sections", "teachers", "news", "organizers"])(
    "keeps a single %s entity current above its collection",
    (feature) => {
      const prefix =
        feature === "news"
          ? "/news"
          : feature === "organizers"
            ? "/catalog/young-events/organizers"
            : `/catalog/${feature}`;
      const links = [
        { href: prefix, label: "Collection" },
        { href: `${prefix}/123`, label: "Known entity" },
      ];
      const url = new URL(
        `${prefix}/123?filter=kept#details`,
        "https://navigation.invalid",
      );
      const active = (link: (typeof links)[number]) =>
        isShellLinkActive(link, url);
      expect(
        links
          .filter((link) => isCurrentScopeLink(link, links, active))
          .map((link) => link.href),
      ).toEqual([`${prefix}/123`]);
      expect(isCurrentScopeLink(links[0], links, active)).toBe(false);
    },
  );
  test("shows only the adjacent directories and keeps leaf services in their parent", () => {
    const copy = buildLayoutCopy("en-us");
    const { scopes } = buildNavigationScopes(copy, user, context);
    const roots = scopes.root.groups[0].links;
    const campus = roots.find((link) => link.id === "campus");
    if (!campus) throw new Error("Missing expected campus navigation row");
    expect(
      navigationScopeChildren(scopes, "root", campus).map((link) => link.href),
    ).toEqual([
      "/catalog/sections",
      "/catalog/courses",
      "/catalog/teachers",
      "/catalog/bus",
      "/catalog/weather",
      "/news",
      "/catalog/links",
      "/catalog/rooms",
    ]);
    const bus = scopes.campus.groups[0].links.find((link) => link.id === "bus");
    if (!bus) throw new Error("Missing expected bus navigation row");
    expect(navigationScopeForLink(scopes, "campus", bus)?.id).toBe("bus");
    expect(navigationScopeForLink(scopes, "root", bus)).toBeUndefined();
    expect(
      navigationScopeChildren(scopes, "campus", bus).map((link) => link.href),
    ).toEqual(["/catalog/bus/map"]);
    expect(displayNavigationScope(scopes, "bus")).toBe("bus");
    for (const leaf of [
      "weather",
      "links",
      "rooms",
      "courses",
      "sections",
      "teachers",
    ])
      expect(displayNavigationScope(scopes, leaf)).toBe("campus");
    expect(displayNavigationScope(scopes, "calendar")).toBe("root");
    expect(displayNavigationScope(scopes, "missing")).toBe("root");
    expect(displayNavigationScope(scopes, "settings")).toBe("settings");
  });
  test("avatar-only upload pages retain root while multi-destination directories remain scoped", () => {
    for (const viewer of [user, admin]) {
      const { current, scopes } = buildNavigationScopes(
        buildLayoutCopy("en-us"),
        viewer,
        {
          ...context,
          pathname: "/workspace/uploads",
        },
      );
      expect(current).toBe("uploads");
      expect(primaryDestination("/workspace/uploads")).toBeNull();
      expect(displayNavigationScope(scopes, current)).toBe("root");
      const rootLinks = scopes.root.groups
        .flatMap((group) => group.links)
        .flatMap((link) => [
          link,
          ...navigationScopeChildren(scopes, "root", link),
        ]);
      expect(
        rootLinks.some((link) =>
          /^\/(?:workspace\/uploads|account|admin)(?:\/|$)/.test(
            new URL(link.href, "https://navigation.invalid").pathname,
          ),
        ),
      ).toBe(false);
      expect(displayNavigationScope(scopes, "settings")).toBe("settings");
      expect(displayNavigationScope(scopes, "apps")).toBe("apps");
      if (viewer.isAdmin)
        expect(displayNavigationScope(scopes, "admin")).toBe("admin");
    }
  });
  test.each([false, true])(
    "anonymous leaf projection does not expose private destinations or stale counts with loading=%s",
    (loading) => {
      const { current, scopes } = buildNavigationScopes(
        buildLayoutCopy("en-us"),
        null,
        {
          ...context,
          pathname: "/workspace/uploads",
          navigation: {
            userId: "retired-owner",
            calendarItemsCount: 99,
            pendingHomeworksCount: 99,
            pendingTodosCount: 99,
            examsCount: 99,
            subscribedSectionCount: 99,
            unreadActivityNotificationsCount: 99,
          },
        },
        loading,
      );
      expect(current).toBe("root");
      expect(displayNavigationScope(scopes, current)).toBe("root");
      expect(scopes.admin).toBeUndefined();
      const roots = scopes.root.groups[0].links;
      expect(roots.map((link) => link.id)).toEqual([
        "workspace",
        "calendar",
        "campus",
        "activities",
      ]);
      const visible = roots.flatMap((link) => [
        link,
        ...navigationScopeChildren(scopes, "root", link),
      ]);
      expect(
        visible.filter(
          (link) =>
            link.href.startsWith("/workspace/") ||
            link.href.startsWith("/admin/") ||
            link.href.startsWith("/account/settings"),
        ),
      ).toEqual([]);
      expect(visible.every((link) => link.badge == null)).toBe(true);
      expect(roots[1].href).toBe(
        "/account/sign-in?callbackUrl=%2Fworkspace%2Fcalendar",
      );
    },
  );
  test("root activities omit deeper record names while the actual directory retains them", () => {
    const copy = buildLayoutCopy("en-us");
    const { scopes } = buildNavigationScopes(copy, user, {
      ...context,
      pathname: "/catalog/young-events/123",
      pageData: { event: { youngId: "123", name: "Current activity" } },
    });
    const activities = scopes.root.groups[0].links.find(
      (link) => link.id === "activities",
    );
    if (!activities)
      throw new Error("Missing expected activities navigation row");
    expect(
      navigationScopeChildren(scopes, "root", activities).map(
        (link) => link.href,
      ),
    ).toEqual([
      "/catalog/young-events/calendar",
      "/catalog/young-events/organizers",
    ]);
    expect(
      scopes.activities.groups[0].links[0].items?.map((link) => link.href),
    ).toEqual(["/catalog/young-events/123"]);
    expect(displayNavigationScope(scopes, "activities")).toBe("activities");
  });
  test.each([
    {
      name: "activity",
      pathname: "/catalog/young-events/123",
      pageData: { event: { youngId: "123", name: "Current activity" } },
      scopeId: "activities",
      collection: "/catalog/young-events",
    },
    {
      name: "organizer",
      pathname: "/catalog/young-events/organizers/abc",
      pageData: { organizer: { id: "abc", name: "Current organizer" } },
      scopeId: "activities",
      collection: "/catalog/young-events/organizers",
    },
    {
      name: "course",
      pathname: "/catalog/courses/12",
      pageData: { course: { nameCn: "Current course" } },
      scopeId: "courses",
      collection: "/catalog/courses",
    },
  ])(
    "keeps the actual $name record under its collection as the unique current child",
    ({ pathname, pageData, scopeId, collection }) => {
      const { scopes } = buildNavigationScopes(buildLayoutCopy("en-us"), user, {
        ...context,
        pathname,
        pageData,
      });
      const rows = scopes[scopeId].groups.flatMap((group) => group.links);
      expect(rows.map((link) => link.href)).not.toContain(pathname);
      const parent = rows.find((link) => link.href === collection);
      if (!parent) throw new Error("Missing record collection");
      const children = navigationScopeChildren(scopes, scopeId, parent);
      expect(children.map((link) => link.href)).toEqual([pathname]);
      expect(children.every((link) => link.items === undefined)).toBe(true);
      const visible = rows.flatMap((link) => [
        link,
        ...navigationScopeChildren(scopes, scopeId, link),
      ]);
      const url = new URL(
        `${pathname}?filter=retained#details`,
        "https://navigation.invalid",
      );
      expect(
        visible
          .filter((link) =>
            isCurrentScopeLink(link, visible, (link) =>
              isShellLinkActive(link, url),
            ),
          )
          .map((link) => link.href),
      ).toEqual([pathname]);
      expect(displayNavigationScope(scopes, scopeId)).toBe(scopeId);
    },
  );
  test("direct children are deduplicated and never retain a grandchild subtree", () => {
    const parent = {
      id: "directory",
      href: "/directory",
      label: "Directory",
      items: [
        {
          href: "/directory/child",
          label: "Child",
          items: [{ href: "/directory/child/grandchild", label: "Grandchild" }],
        },
        { href: "/directory/child", label: "Duplicate child" },
        { href: "/directory", label: "Duplicate parent" },
      ],
    };
    const expected = [{ href: "/directory/child", label: "Child" }];
    expect(navigationScopeChildren({}, "directory", parent)).toEqual(expected);
    const scopes: Record<string, NavigationScope> = {
      directory: {
        id: "directory",
        label: "Directory",
        parent: "root",
        groups: [],
        previewLinks: parent.items,
      },
    };
    expect(navigationScopeChildren(scopes, "root", parent)).toEqual(expected);
    expect(parent.items[0].items).toEqual([
      { href: "/directory/child/grandchild", label: "Grandchild" },
    ]);
  });
  test("explicit personal and moderation directories never cross their parent boundary", () => {
    const { scopes } = buildNavigationScopes(
      buildLayoutCopy("en-us"),
      admin,
      context,
    );
    const notifications = scopes.workspace.groups[0].links.find(
      (link) => link.id === "activityNotifications",
    );
    if (!notifications)
      throw new Error("Missing expected notifications navigation row");
    expect(navigationScopeForLink(scopes, "workspace", notifications)?.id).toBe(
      "activity-workspace",
    );
    expect(
      navigationScopeForLink(scopes, "root", notifications),
    ).toBeUndefined();
    const moderation = scopes.admin.groups[0].links.find(
      (link) => link.id === "adminModeration",
    );
    if (!moderation)
      throw new Error("Missing expected moderation navigation row");
    expect(navigationScopeForLink(scopes, "admin", moderation)?.id).toBe(
      "admin-queues",
    );
    expect(
      navigationScopeChildren(scopes, "admin", moderation).every(
        (link) => link.href !== moderation.href,
      ),
    ).toBe(true);
  });
  test.each([
    ["", "Comments"],
    ["?tab=comments", "Comments"],
    ["?tab=descriptions&page=2", "Descriptions"],
    ["?tab=unknown", "Moderation"],
  ])(
    "moderation parent yields to the active query row at %s",
    (query, expected) => {
      const links = [
        { href: "/admin/moderation", label: "Moderation" },
        { href: "/admin/moderation?tab=comments", label: "Comments" },
        { href: "/admin/moderation?tab=descriptions", label: "Descriptions" },
      ];
      const url = new URL(
        `/admin/moderation${query}`,
        "https://navigation.invalid",
      );
      expect(
        links
          .filter((link) =>
            isCurrentScopeLink(link, links, (link) =>
              isShellLinkActive(link, url),
            ),
          )
          .map((link) => link.label),
      ).toEqual([expected]);
    },
  );
  test("query sibling current remains exact", () => {
    const links = ["events", "organizers", "notifications"].map((view) => ({
      href: `/workspace/subscriptions/activities?view=${view}`,
      label: view,
    }));
    const url = new URL(
      "https://navigation.invalid/workspace/subscriptions/activities?view=organizers&page=2",
    );
    expect(
      links
        .filter((link) =>
          isCurrentScopeLink(link, links, (link) =>
            isShellLinkActive(link, url),
          ),
        )
        .map((link) => link.label),
    ).toEqual(["organizers"]);
  });
  test("retains real Calendar summary and hides unknown counts", () => {
    const copy = buildLayoutCopy("en-us");
    const base = {
      userId: "owned",
      calendarItemsCount: 4,
      pendingHomeworksCount: 1,
      pendingTodosCount: 2,
      examsCount: 1,
      subscribedSectionCount: 1,
      unreadActivityNotificationsCount: 1,
    };
    const known = buildNavigationScopes(copy, user, {
      ...context,
      pathname: "/workspace/calendar",
      navigation: base,
    }).scopes.calendar.groups[0].links[0];
    expect(
      buildNavigationScopes(copy, user, {
        ...context,
        navigation: base,
      }).primary.find((link) => link.id === "calendar")?.badge,
    ).toBe(4);
    expect(known.badge).toBe(4);
    expect(known.badgeLabel).toContain("not this view");
    expect(
      buildNavigationScopes(copy, user, {
        ...context,
        pathname: "/workspace/calendar",
      }).scopes.calendar.groups[0].links[0].badge,
    ).toBeUndefined();
  });
  test("classifies secondary contexts without exposing another viewer's destinations", () => {
    const copy = buildLayoutCopy("en-us");
    for (const [pathname, current] of [
      ["/workspace/uploads", "uploads"],
      ["/account/settings/security", "settings"],
      ["/workspace/subscriptions/activities", "activity-workspace"],
      ["/admin/moderation", "admin-queues"],
      ["/workspace/calendar", "root"],
    ])
      expect(
        buildNavigationScopes(copy, admin, { ...context, pathname }).current,
      ).toBe(current);
    expect(
      buildNavigationScopes(copy, null, {
        ...context,
        pathname: "/admin/users",
      }).current,
    ).toBe("root");
  });
  test.each(["events", "organizers", "notifications"])(
    "keeps sibling activity subscription pages reachable from %s",
    (view) => {
      const model = buildNavigationScopes(buildLayoutCopy("en-us"), user, {
        ...context,
        pathname: "/workspace/subscriptions/activities",
        search: `?view=${view}`,
      });
      expect(model.current).toBe("activity-workspace");
      expect(displayNavigationScope(model.scopes, model.current)).toBe(
        "activity-workspace",
      );
      expect(
        model.scopes[model.current].groups[0].links.map((link) => link.href),
      ).toEqual([
        "/workspace/subscriptions/activities?view=events",
        "/workspace/subscriptions/activities?view=organizers",
        "/workspace/subscriptions/activities?view=notifications",
      ]);
    },
  );
});

vi.mock("@lucide/svelte/icons/app-window", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bell", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/book-open", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bookmark-check", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bot", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/bus-front", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/cable", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/calendar-days", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/circle-user", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/clipboard-check", () => ({
  default: () => null,
}));
vi.mock("@lucide/svelte/icons/cloud-sun", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/files", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/gavel", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/graduation-cap", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/landmark", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/library-big", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/link", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/list-todo", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/map", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/map-pinned", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/party-popper", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/route", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/scroll-text", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/settings", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/shield-check", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/smartphone", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/sparkles", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/sunrise", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/terminal", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/user-cog", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/users", () => ({ default: () => null }));
vi.mock("@lucide/svelte/icons/wrench", () => ({ default: () => null }));
