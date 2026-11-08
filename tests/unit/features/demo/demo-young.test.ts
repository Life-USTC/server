import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDemoCalendarEvents } from "@/features/demo/server/demo-calendar-events";
import {
  getDemoYoungCalendar,
  getDemoYoungEvent,
  getDemoYoungEvents,
  getDemoYoungHomeActivities,
  getDemoYoungOrganizer,
  getDemoYoungOrganizers,
  getDemoYoungRecords,
} from "@/features/demo/server/demo-young";
import { getDemoYoungPoster } from "@/features/demo/server/demo-young-assets";
import {
  youngCalendarDays,
  youngCalendarRange,
} from "@/features/young/lib/young-calendar";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import { parseYoungTableFilters } from "@/features/young/server/young-table-filter-schema";

const reference = "2026-09-24T09:00:00+08:00";
const ids = (rows: readonly { youngId: string }[]) =>
  rows.map((row) => row.youngId).sort();
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing sealed Young fixture");
  return value;
}

for (const locale of ["en-us", "zh-cn"] as const) {
  describe(`sealed Young graph: ${locale}`, () => {
    it("preserves the five Home activities and their linked detail facts", () => {
      const expected =
        locale === "en-us"
          ? [
              "Fictional algebra discussion",
              "Fictional physics reading",
              "Fictional programming workshop",
              "Fictional study exchange",
              "Fictional science sketching",
            ]
          : [
              "虚构代数讨论",
              "虚构物理共读",
              "虚构编程工作坊",
              "虚构学习交流",
              "虚构科学速写",
            ];
      const home = getDemoYoungHomeActivities(locale);
      expect(home.map((event) => event.title)).toEqual(expected);
      expect(home.map((event) => event.dateLabel)).toEqual([
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
        "2026-09-28",
      ]);
      home.forEach((event, index) => {
        const id = `demo-young-${index + 1}`;
        expect(event).toMatchObject({
          key: `demo-home-activity-${index + 1}`,
          href: `/catalog/young-events/${id}`,
          crossDay: false,
        });
        expect(event.meta).toBe(
          locale === "en-us"
            ? "Fictional demo sample · Not a public event"
            : "虚构演示样例 · 非真实公开活动",
        );
        const detail = required(getDemoYoungEvent(locale, id));
        expect(detail.name).toBe(event.title);
        expect(detail.startAt?.slice(0, 10)).toBe(event.dateLabel);
      });
    });

    it("has real full-size continuation pages for activities and organizers", () => {
      const pages = [1, 2, 3].map((page) =>
        getDemoYoungEvents(locale, { page }),
      );
      expect(pages.map((page) => page.data.length)).toEqual([20, 20, 2]);
      expect(pages[0].pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 42,
        totalPages: 3,
      });
      expect(
        new Set(
          pages.flatMap((page) => page.data.map((event) => event.youngId)),
        ).size,
      ).toBe(42);
      const organizerPages = [1, 2].map((page) =>
        getDemoYoungOrganizers(locale, { page }),
      );
      expect(organizerPages.map((page) => page.data.length)).toEqual([20, 2]);
      expect(
        new Set(
          organizerPages.flatMap((page) =>
            page.data.map((organizer) => organizer.id),
          ),
        ).size,
      ).toBe(22);
      const main = [1, 2].map((page) =>
        getDemoYoungEvents(locale, {
          organizerId: "demo-young-organizer-1",
          page,
        }),
      );
      expect(main.map((page) => page.data.length)).toEqual([20, 2]);
      expect(main[0].pagination.total).toBe(22);
      expect(
        getDemoYoungEvents(locale, { organizerId: "demo-young-organizer-22" }),
      ).toMatchObject({ data: [], pagination: { total: 0, totalPages: 1 } });
      expect(
        getDemoYoungEvents(locale, { organizerId: "real-organizer" }),
      ).toMatchObject({ data: [], pagination: { total: 0, totalPages: 1 } });
      for (const event of pages[0].data) {
        expect(event).not.toHaveProperty("description");
        expect(event).not.toHaveProperty("rawJson");
      }
    });

    it("keeps unknown dates, no signup and withdrawn source as distinct facts", () => {
      expect(
        ids(getDemoYoungEvents(locale, { dateUnknown: true }).data),
      ).toEqual(["demo-young-7"]);
      expect(
        ids(
          getDemoYoungEvents(locale, {
            timeBasis: "registration",
            dateUnknown: true,
          }).data,
        ),
      ).toEqual(["demo-young-13", "demo-young-8"]);
      expect(
        ids(
          getDemoYoungEvents(locale, { tableFilters: {}, dateUnknown: true })
            .data,
        ),
      ).toEqual(["demo-young-13", "demo-young-7", "demo-young-8"]);
      expect(
        getDemoYoungEvents(locale, { tableFilters: {}, dateUnknown: false })
          .pagination.total,
      ).toBe(42);
      expect(
        getDemoYoungEvents(locale, { dateUnknown: false }).pagination.total,
      ).toBe(41);
      expect(
        required(getDemoYoungEvent(locale, "demo-young-13")),
      ).toMatchObject({
        requiresSignup: false,
        applyStartAt: null,
        applyEndAt: null,
      });
      expect(required(getDemoYoungEvent(locale, "demo-young-9"))).toMatchObject(
        {
          isActive: true,
          sourceMissing: true,
          startAt: "2026-10-02T08:30:00+08:00",
          endAt: "2026-10-03T10:30:00+08:00",
          conflictIntervals: [],
        },
      );
      expect(getDemoYoungEvents(locale).source).toEqual({
        status: "unknown",
        lastSyncedAt: null,
      });
      for (const event of getDemoYoungRecords(locale)) {
        expect(event.lastSeenAt).toBeNull();
        expect(event.createdAtUpstream).toBeNull();
        expect(event.updatedAtUpstream).toBeNull();
      }
    });

    it("uses Shanghai day bounds and the selected time basis before pagination", () => {
      const window = { dateFrom: "2026-09-27", dateTo: "2026-09-27" };
      const activity = getDemoYoungCalendar(locale, window);
      const signup = getDemoYoungCalendar(locale, {
        ...window,
        timeBasis: "registration",
      });
      expect(ids(activity.data)).toEqual([
        "demo-young-18",
        "demo-young-32",
        "demo-young-4",
      ]);
      expect(ids(signup.data)).toEqual(["demo-young-6"]);
      expect(activity.unknownDateCount).toBe(1);
      expect(signup.unknownDateCount).toBe(2);
      const crossing = getDemoYoungCalendar(locale, {
        dateFrom: "2026-10-03",
        dateTo: "2026-10-03",
      });
      expect(ids(crossing.data)).toContain("demo-young-9");
      expect(
        ids(
          getDemoYoungCalendar(locale, {
            dateFrom: "2026-10-04",
            dateTo: "2026-10-04",
          }).data,
        ),
      ).not.toContain("demo-young-9");
    });

    it("retains repeated choices, cross-field AND and numeric zero operators", () => {
      const filters = parseYoungTableFilters(
        new URLSearchParams({
          module: "德",
          capacity: "20",
          capacityOp: "between",
          capacityMax: "25",
        }),
        "events",
      );
      const choices = new URLSearchParams();
      choices.append("category", "单次项目");
      choices.append("category", "系列项目");
      for (const [key, value] of Object.entries(filters))
        choices.set(key, value);
      expect(
        ids(
          getDemoYoungEvents(locale, {
            tableFilters: parseYoungTableFilters(choices, "events"),
          }).data,
        ),
      ).toEqual(["demo-young-1", "demo-young-6"]);
      expect(
        ids(
          getDemoYoungEvents(locale, { tableFilters: { appliedCount: "0" } })
            .data,
        ),
      ).toEqual(["demo-young-1"]);
      expect(
        ids(
          getDemoYoungEvents(locale, {
            tableFilters: { appliedCount: "40", appliedCountOp: "gt" },
          }).data,
        ),
      ).toEqual(["demo-young-42"]);
      const statusLabels =
        locale === "en-us"
          ? {
              statusOpen: "Current signup list",
              statusClosed: "Historical activity list",
            }
          : { statusOpen: "当前报名列表", statusClosed: "历史活动列表" };
      expect(
        getDemoYoungEvents(locale, {
          tableFilters: { status: statusLabels.statusOpen },
          tableStatusLabels: statusLabels,
        }).pagination.total,
      ).toBe(31);
      expect(
        getDemoYoungEvents(locale, {
          tableFilters: { status: statusLabels.statusClosed },
          tableStatusLabels: statusLabels,
        }).pagination.total,
      ).toBe(11);
      const sameDay = getDemoYoungEvents(locale, {
        tableFilters: { startAt: "2026-09-24", startAtOp: "eq" },
      });
      expect(sameDay.pagination.total).toBe(4);
      expect(ids(sameDay.data).sort()).toEqual([
        "demo-young-1",
        "demo-young-15",
        "demo-young-28",
        "demo-young-29",
      ]);

      expect(
        getDemoYoungEvents(locale, {
          search: "  no such fictional activity  ",
        }),
      ).toMatchObject({ data: [], pagination: { total: 0, totalPages: 1 } });
    });

    it("derives independent organizer counts from the fixed clock", () => {
      expect(
        required(getDemoYoungOrganizer(locale, "demo-young-organizer-1")),
      ).toMatchObject({
        totalCount: 22,
        activeCount: 21,
        upcomingCount: 18,
        historyCount: 1,
      });
      expect(
        required(getDemoYoungOrganizer(locale, "demo-young-organizer-8")),
      ).toMatchObject({
        totalCount: 1,
        activeCount: 1,
        upcomingCount: 0,
        historyCount: 0,
      });
      expect(
        required(getDemoYoungOrganizer(locale, "demo-young-organizer-22")),
      ).toMatchObject({
        totalCount: 0,
        activeCount: 0,
        upcomingCount: 0,
        historyCount: 0,
      });
      expect(
        getDemoYoungOrganizers(locale, {
          tableFilters: { activeCount: "20", activeCountOp: "gte" },
        }).data.map((organizer) => organizer.id),
      ).toEqual(["demo-young-organizer-1"]);
    });

    it("keeps Sunday grids, cross-day display and real teaching conflicts consistent", () => {
      expect(youngCalendarRange("week", "2026-09-24")).toEqual({
        start: "2026-09-20",
        end: "2026-09-26",
      });
      const range = youngCalendarRange("month", "2026-09-24");
      expect(range).toEqual({ start: "2026-08-30", end: "2026-10-03" });
      const calendar = getDemoYoungCalendar(locale, {
        dateFrom: range.start,
        dateTo: range.end,
      });
      const days = youngCalendarDays(
        "month",
        range,
        calendar.data,
        new Date(reference),
        "activity",
        "2026-09-24",
      );
      expect(days).toHaveLength(35);
      expect(days.filter((day) => day.isToday).map((day) => day.key)).toEqual([
        "2026-09-24",
      ]);
      expect(
        ids(required(days.find((day) => day.key === "2026-10-02")).events),
      ).toContain("demo-young-9");
      expect(
        ids(required(days.find((day) => day.key === "2026-10-03")).events),
      ).toContain("demo-young-9");
      expect(
        days
          .flatMap((day) => day.events)
          .some((event) => event.youngId === "demo-young-7"),
      ).toBe(false);
      const conflicts = youngCalendarConflicts(
        calendar.data,
        getDemoCalendarEvents(locale),
      );
      expect(conflicts.has("demo-young-1")).toBe(true);
      expect(conflicts.has("demo-young-9")).toBe(false);
    });
  });
}

it("serves only the known fictional poster with independent bytes and no origin lookup", () => {
  const poster = required(getDemoYoungPoster("demo-young-poster.png"));
  expect(poster.contentType).toBe("image/png");
  expect(poster.sha256).toBe(
    createHash("sha256").update(poster.bytes).digest("hex"),
  );
  expect([...poster.bytes.slice(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  for (const path of [
    "real-poster.png",
    "../demo-young-poster.png",
    "https://young.ustc.edu.cn/image.png",
    "",
  ])
    expect(getDemoYoungPoster(path)).toBeNull();
  poster.bytes.fill(0);
  expect(required(getDemoYoungPoster("demo-young-poster.png")).bytes[0]).toBe(
    137,
  );
});

it("rejects foreign targets and preserves ordinary range validation and fresh projections", () => {
  for (const id of ["", "real-event", "demo-young-43", "__proto__"])
    expect(getDemoYoungEvent("en-us", id)).toBeNull();
  for (const id of [
    "",
    "real-organizer",
    "demo-young-organizer-23",
    "__proto__",
  ])
    expect(getDemoYoungOrganizer("en-us", id)).toBeNull();
  for (const input of [
    { dateFrom: "2026-09-25", dateTo: "2026-09-24" },
    { dateFrom: "2026-01-01", dateTo: "2028-01-01" },
    { dateFrom: new Date(NaN) },
    { dateUnknown: true, dateFrom: "2026-09-24" },
  ])
    expect(() => getDemoYoungEvents("en-us", input)).toThrow(RangeError);
  const record = required(getDemoYoungEvent("en-us", "demo-young-1"));
  record.name = "Private user text";
  record.upstreamOrganizerIds.push("private-upstream");
  expect(required(getDemoYoungEvent("en-us", "demo-young-1")).name).toBe(
    "Fictional algebra discussion",
  );
  expect(
    required(getDemoYoungEvent("en-us", "demo-young-1")).upstreamOrganizerIds,
  ).toEqual([]);
});
