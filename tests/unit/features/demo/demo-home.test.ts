import { beforeEach, describe, expect, it, vi } from "vitest";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import {
  demoNavigationLink,
  isDemoNavigationDestination,
} from "@/features/demo/lib/demo-navigation";
import {
  getDemoHomeCampusNow,
  getDemoHomeInformation,
  getDemoHomeOverview,
} from "@/features/demo/server/demo-home";
import { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import { GET as activities } from "@/routes/_internal/home/activities/+server";
import { GET as campus } from "@/routes/_internal/home/campus-now/+server";
import { GET as notices } from "@/routes/_internal/home/notices/+server";
import { GET as viewer } from "@/routes/_internal/home/viewer/+server";

const live = vi.hoisted(() => ({
  information: vi.fn(),
  campus: vi.fn(),
  notices: vi.fn(),
  activities: vi.fn(),
  viewer: vi.fn(),
}));
vi.mock("@/features/workspace/server/anonymous-home-sections", () => ({
  loadAnonymousHomeInformation: live.information,
  loadHomeCampusNow: live.campus,
  loadHomeNotices: live.notices,
  loadHomeActivities: live.activities,
}));
vi.mock("@/features/workspace/server/workspace-page-load", () => ({
  loadSignedWorkspacePage: live.viewer,
}));
const identity = {
  fixtureVersion: "workspace-v1",
  expiresAt: 1_800_000_000_000,
} as const;
function event(
  locale: "en-us" | "zh-cn",
  demo: typeof identity | null = identity,
  query = "",
) {
  const url = new URL(`https://demo.test/?${query}`);
  return {
    locals: {
      locale,
      demo,
      requestId: "unit-home",
      authUser: demo ? null : { id: "ordinary-owner" },
    },
    request: new Request(url),
    url,
  };
}
beforeEach(() => {
  for (const fn of Object.values(live)) fn.mockReset();
});

describe("sealed demo Home", () => {
  it("owns public reads by mode and verified demo generation, not ordinary viewer identity", () => {
    const demo = {
      ...identity,
      referenceNow: "2026-09-24T09:00:00+08:00",
      displayName: "Demo",
      readOnlyReason: "Read only",
      unavailableReason: "Unavailable",
      exitLabel: "Exit",
      referenceTimeLabel: "Reference",
    };
    expect(homePublicReadEpoch({ viewer: null, status: "ready" })).toBe(
      "public",
    );
    for (const id of ["ordinary-a", "ordinary-b"])
      expect(
        homePublicReadEpoch({ viewer: { id } as never, status: "ready" }),
      ).toBe("public");
    expect(homePublicReadEpoch({ viewer: null, status: "ready" }, demo)).toBe(
      "",
    );
    expect(
      homePublicReadEpoch({ viewer: null, demo, status: "loading" }, demo),
    ).toBe("");
    expect(homePublicReadEpoch({ viewer: null, demo, status: "ready" })).toBe(
      "",
    );
    expect(
      homePublicReadEpoch(
        { viewer: null, demo, status: "ready" },
        { ...demo, expiresAt: demo.expiresAt - 1 },
      ),
    ).toBe("");
    expect(
      homePublicReadEpoch({ viewer: null, demo, status: "ready" }, demo),
    ).toBe(`demo:workspace-v1:${identity.expiresAt}`);
  });
  it("keeps delivered academic destinations and metadata while disabling unfinished directory children", () => {
    for (const href of [
      "/",
      "/catalog/sections/910001",
      "/catalog/courses/920001",
      "/catalog/teachers/401",
      "/account/settings/profile",
    ])
      expect(isDemoNavigationDestination(href)).toBe(true);
    for (const href of [
      "https://example.test",
      "/catalog/links",
      "/catalog/sections/999",
      "/account/settings/security",
    ])
      expect(isDemoNavigationDestination(href)).toBe(false);
    const link = demoNavigationLink(
      {
        href: "/account/settings/profile",
        label: "Settings",
        id: "settings",
        badge: 2,
        items: [
          { href: "/account/settings/profile", label: "Profile" },
          { href: "/account/settings/security", label: "Security" },
        ],
      },
      "Unavailable",
    );
    expect(link).toMatchObject({
      id: "settings",
      badge: 2,
      items: [
        { href: "/account/settings/profile", label: "Profile" },
        { href: "/account/settings/security", disabledReason: "Unavailable" },
      ],
    });
    expect(link.items[0]).not.toHaveProperty("disabledReason");
    expect(
      demoNavigationLink(
        {
          href: "/catalog/links",
          label: "Websites",
          items: [
            { href: "/api/catalog/links/resolve?slug=sample", label: "Visit" },
          ],
        },
        "Unavailable",
      ),
    ).toMatchObject({
      disabledReason: "Unavailable",
      items: [{ disabledReason: "Unavailable" }],
    });
  });
  it.each(["en-us", "zh-cn"] as const)(
    "derives full overview and editorial data without ordinary readers in %s",
    async (locale) => {
      const input = event(locale);
      const page = await loadHomePage(input as never);
      const response = await viewer(input as never);
      const body = await response.json();
      expect(body).toMatchObject({
        signedIn: true,
        tab: "overview",
        referenceNow: "2026-09-24T09:00:00+08:00",
        navStats: {
          user: { id: "demo:workspace-v1", username: null },
          pendingHomeworksCount: 3,
          calendarItemsCount: 9,
          examsCount: 2,
          pendingTodosCount: 2,
        },
        overview: {
          hasCurrentTermSelection: true,
          currentTermName: "2026年秋季学期",
          dueToday: [],
          overviewLinks: [],
        },
      });
      expect(
        body.overview.pendingHomeworks.map((item: { id: string }) => item.id),
      ).toEqual([
        "demo-homework-determinants",
        "demo-homework-vectors",
        "demo-homework-project",
      ]);
      expect(
        body.overview.todaySessions.map(
          (item: { weekIndex: number; dateKey: string }) => [
            item.weekIndex,
            item.dateKey,
          ],
        ),
      ).toEqual([
        [4, "2026-09-24"],
        [4, "2026-09-24"],
      ]);
      expect(body.overview.calendar.allExams).toHaveLength(2);
      expect(body.overview.calendar.semesterWeeks[0][0]).toBe("2026-08-30");
      expect(body.todos).toHaveLength(3);
      expect(page).toMatchObject({
        demo: { ...identity, referenceNow: body.referenceNow },
      });
      expect(page.information.notices).toHaveLength(5);
      expect(page.information.activities).toHaveLength(5);
      for (const [route, key] of [
        [notices, "notices"],
        [activities, "activities"],
      ] as const) {
        const result = await route(input as never);
        expect((await result.json())[key]).toEqual(page.information[key]);
        expect(result.headers.get("cache-control")).toBe("private, no-store");
      }
      const result = await campus(input as never);
      const sample = await result.json();
      expect(sample.weather).toHaveLength(2);
      expect(
        sample.weather[0].hourly.map((hour: { label: string }) => hour.label),
      ).toEqual(["09:00", "10:00", "11:00"]);
      expect(
        sample.bus.departures.map(
          (bus: { departureTime: string }) => bus.departureTime,
        ),
      ).toEqual(["09:05", "09:20", "09:35", "09:50", "10:05"]);
      expect(JSON.stringify(sample)).toMatch(
        locale === "en-us" ? /Fictional/ : /虚构/,
      );
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
      for (const fn of Object.values(live)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it("does not adopt a caller clock or an out-of-fixture week", async () => {
    for (const query of [
      "snapshotAt=2040-01-01",
      "snapshotAt=invalid",
      "overviewWeek=2026-02-30",
      "overviewWeek=2025-09-24",
      "overviewWeek=2026-08-29",
      "overviewWeek=2027-01-31",
    ]) {
      expect(
        getDemoHomeOverview(identity, "en-us", new URLSearchParams(query)),
      ).toBeNull();
      const result = await viewer(event("en-us", identity, query) as never);
      expect(result.status).toBe(400);
    }
    const result = getDemoHomeOverview(
      identity,
      "en-us",
      new URLSearchParams(
        "snapshotAt=2026-09-24T01:00:00Z&overviewWeek=2026-10-04",
      ),
    );
    expect(result).toMatchObject({
      overviewWeek: "2026-10-04",
      referenceNow: "2026-09-24T09:00:00+08:00",
    });
    for (const date of [
      "2026-08-30",
      "2026-09-01",
      "2027-01-24",
      "2027-01-30",
    ]) {
      expect(
        getDemoHomeOverview(
          identity,
          "en-us",
          new URLSearchParams({ overviewWeek: date }),
        ),
      ).toMatchObject({ overviewWeek: date });
    }
    expect(live.viewer).not.toHaveBeenCalled();
    expect(getDemoHomeCampusNow("en-us", "bus").weather).toBeNull();
    expect(getDemoHomeCampusNow("en-us", "weather").bus).toBeNull();
  });

  it("retains ordinary delegation and public payloads", async () => {
    const input = event("en-us", null);
    const information = { notices: [], activities: [] };
    live.information.mockResolvedValue(information);
    expect((await loadHomePage(input as never)).information).toBe(information);
    expect(live.information).toHaveBeenCalledOnce();
    live.viewer.mockResolvedValue({ signedIn: true, ordinary: true });
    expect(await (await viewer(input as never)).json()).toEqual({
      signedIn: true,
      ordinary: true,
    });
    expect(live.viewer).toHaveBeenCalledWith({
      ...input,
      tab: "overview",
      userId: "ordinary-owner",
    });
    for (const [route, fn, payload] of [
      [notices, live.notices, { notices: [] }],
      [activities, live.activities, { activities: [] }],
      [campus, live.campus, { bus: null, weather: null }],
    ] as const) {
      fn.mockResolvedValue(payload);
      const response = await route(input as never);
      expect(await response.json()).toEqual(payload);
      expect(fn).toHaveBeenCalledOnce();
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=0, no-store",
      );
    }
    expect(getDemoHomeInformation("en-us").notices?.[0].dateLabel).toBe(
      "2026-09-24",
    );
  });
});
