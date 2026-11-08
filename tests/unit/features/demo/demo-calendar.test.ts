import { describe, expect, it, vi } from "vitest";
import { getDemoCalendar } from "@/features/demo/server/demo-calendar";
import {
  getDemoCalendarEvents,
  readDemoCalendarEvents,
} from "@/features/demo/server/demo-calendar-events";
import { getDemoCatalogSection } from "@/features/demo/server/demo-catalog";
import {
  getDemoNavigation,
  getDemoWorkspacePage,
} from "@/features/demo/server/demo-workspace";
import { workspaceCalendarOwner } from "@/features/workspace/lib/workspace-calendar-owner";
import { getDemoCalendarRoute } from "@/lib/api/routes/demo-calendar-route";
import { personalCalendarPageSchema } from "@/lib/api/schemas/young-workspace-schemas";

describe("fixed personal calendar", () => {
  const identity = {
    fixtureVersion: "workspace-v1" as const,
    expiresAt: 1790212500000,
  };
  for (const locale of ["zh-cn", "en-us"] as const) {
    it(`projects the existing catalog and pending task facts in ${locale}`, () => {
      const events = getDemoCalendarEvents(locale);
      expect(events).toHaveLength(32);
      expect(events.filter(({ type }) => type === "schedule")).toHaveLength(3);
      expect(events.filter(({ type }) => type === "exam")).toHaveLength(3);
      expect(
        events
          .filter(({ type }) => type === "homework_due")
          .map(({ target }) => target.id),
      ).toEqual([
        "demo-homework-determinants",
        "demo-homework-vectors",
        "demo-homework-physics",
      ]);
      expect(events.filter(({ type }) => type === "todo_due")).toHaveLength(2);
      for (const jwId of [910001, 910002, 910003]) {
        const section = getDemoCatalogSection(jwId, locale);
        if (!section) throw new Error("Missing fixture section");
        const schedule = events.find(
          ({ type, sectionJwId }) =>
            type === "schedule" && sectionJwId === jwId,
        );
        expect(schedule).toMatchObject({
          at: `${section.schedules[0].date?.slice(0, 10)}T08:00:00+08:00`,
          endsAt: `${section.schedules[0].date?.slice(0, 10)}T09:45:00+08:00`,
          url: `/catalog/sections/${jwId}`,
          title: section.course.namePrimary,
        });
        expect(schedule?.conflictIntervals).toHaveLength(1);
        expect(
          events.find(({ id }) => id === `exam-${section.exams[0].id}`),
        ).toMatchObject({
          at: `${section.exams[0].examDate?.slice(0, 10)}T14:00:00+08:00`,
          endsAt: `${section.exams[0].examDate?.slice(0, 10)}T16:00:00+08:00`,
        });
      }
      expect(new Set(events.map(({ id }) => id)).size).toBe(events.length);
      expect(
        personalCalendarPageSchema.safeParse(readDemoCalendarEvents(locale)),
      ).toMatchObject({ success: true });
    });
  }
  it("uses its fixed clock and genuine pagination across the full semester", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2040-01-01"));
      expect(readDemoCalendarEvents("en-us").data).toHaveLength(14);
      const query = {
        dateFrom: "2026-09-01",
        dateTo: "2027-01-24",
        pageSize: 2,
      };
      const first = readDemoCalendarEvents("en-us", query);
      expect(first.pagination).toEqual({
        page: 1,
        pageSize: 2,
        total: 30,
        totalPages: 15,
      });
      const pages = Array.from(
        { length: 15 },
        (_, i) =>
          readDemoCalendarEvents("en-us", { ...query, page: i + 1 }).data,
      ).flat();
      expect(pages).toHaveLength(30);
      expect(new Set(pages.map(({ id }) => id)).size).toBe(30);
      expect(
        readDemoCalendarEvents("en-us", { ...query, page: 16 }).data,
      ).toEqual([]);
      expect(pages.filter(({ type }) => type === "exam")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("uses exact Shanghai inclusive-date and overlap boundaries", () => {
    expect(
      readDemoCalendarEvents("en-us", {
        dateFrom: "2026-09-24T09:00:00+08:00",
        dateTo: "2026-09-24T09:44:59+08:00",
      }).data,
    ).toHaveLength(5);
    expect(
      readDemoCalendarEvents("en-us", {
        dateFrom: "2026-09-24T09:45:00+08:00",
        dateTo: "2026-09-24T10:00:00+08:00",
      }).data,
    ).toHaveLength(1);
    expect(
      readDemoCalendarEvents("en-us", {
        dateFrom: "2027-01-08",
        dateTo: "2027-01-08",
      }).data,
    ).toHaveLength(2);
  });
  it("keeps full semester page and API facts aligned, including historical and unknown selection", () => {
    const current = getDemoCalendar(identity, "en-us");
    expect(current.activeCalendarSemesterId).toBe(2609);
    expect(current.allSessions.map(({ weekIndex }) => weekIndex)).toEqual([
      4, 4,
    ]);
    expect(current.allSessions).toHaveLength(2);
    expect(current.allExams).toHaveLength(2);
    expect(current.semesterHomeworks).toHaveLength(3);
    expect(current.semesterTodos).toHaveLength(2);
    expect(current.semesterWeeks[0][0]).toBe("2026-08-30");
    expect(current.semesterWeeks.at(-1)?.at(-1)).toBe("2027-01-30");
    expect(getDemoNavigation(identity).calendarItemsCount).toBe(30);
    expect(
      getDemoWorkspacePage(identity, "en-us", "calendar").overview?.calendar,
    ).toEqual(current);
    const past = getDemoCalendar(identity, "en-us", 2602);
    expect(past.allSessions.map(({ weekIndex }) => weekIndex)).toEqual([3]);
    expect(past.allExams).toHaveLength(1);
    expect(past.semesterHomeworks).toEqual([]);
    expect(past.semesterTodos).toEqual([]);
    expect(past.todayDate).toBe("2026-09-24");
    expect(getDemoCalendar(identity, "en-us", 999999)).toEqual(current);
  });
  it("requires a matching root demo epoch rather than stale leaf presentation data", () => {
    const demo = getDemoWorkspacePage(identity, "en-us", "calendar").demo;
    expect(
      workspaceCalendarOwner({ viewer: null, status: "ready" }, demo).id,
    ).toBe("");
    expect(
      workspaceCalendarOwner({ viewer: null, demo, status: "loading" }, demo)
        .id,
    ).toBe("");
    expect(
      workspaceCalendarOwner(
        { viewer: null, demo, status: "ready" },
        { ...demo, expiresAt: demo.expiresAt - 1 },
      ).id,
    ).toBe("");
    expect(
      workspaceCalendarOwner({ viewer: null, demo, status: "ready" }, demo),
    ).toEqual({
      id: "demo:workspace-v1",
      epoch: `demo:workspace-v1:${demo.expiresAt}`,
    });
  });
  it("rejects invalid ranges and unsupported owner selectors through the API", async () => {
    for (const query of [
      "dateFrom=2026-09-24",
      "dateFrom=no&dateTo=no",
      "dateFrom=2026-10-01&dateTo=2026-09-01",
      "dateFrom=2026-01-01&dateTo=2027-01-03",
      "userId=victim",
      "pageSize=101",
    ]) {
      expect(
        getDemoCalendarRoute(
          new Request(
            `https://example.test/api/workspace/calendar/events?${query}`,
          ),
          "en-us",
        ).status,
      ).toBe(400);
    }
    const response = getDemoCalendarRoute(
      new Request("https://example.test/api/workspace/calendar/events"),
      "en-us",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).data).toHaveLength(14);
  });
});
