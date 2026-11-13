import { describe, expect, test, vi } from "vitest";
import { isShellLinkActive } from "@/lib/components/shell/navigation";
import {
  buildNavigationScopes,
  buildPrimaryDestinations,
  isCurrentScopeLink,
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
describe("four primary navigation and flat owned directories", () => {
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
          for (const link of scope.groups.flatMap((g) => g.links))
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
      ["/workspace/calendar", "calendar"],
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
