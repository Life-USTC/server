import { resetLocalTimeZone } from "@internationalized/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeYoungCalendarDate,
  youngCalendarAgenda,
  youngCalendarDays,
  youngCalendarHeading,
  youngCalendarNextDate,
  youngCalendarPreviousDate,
  youngCalendarRange,
  youngCalendarWeeks,
} from "@/features/young/lib/young-calendar";
import type { YoungEventSummary } from "@/features/young/server/young-event-service";

function event(
  youngId: string,
  startAt: string | null,
  endAt: string | null,
): YoungEventSummary {
  return {
    youngId,
    name: youngId,
    category: null,
    department: null,
    organizer: null,
    organizerId: null,
    status: null,
    activityStatusCode: null,
    signupStatusCode: null,
    requiresSignup: null,
    categoryCode: null,
    moduleCode: null,
    formCode: null,
    activityLevelCode: null,
    departmentId: null,
    upstreamOrganizerIds: [],
    upstreamSponsorIds: [],
    tagIds: [],
    signupScopeCode: null,
    signupDepartmentIds: [],
    requiresSignupInfo: null,
    allowedAttachmentTypes: [],
    isOnline: null,
    onlineMeetingInfo: null,
    externalSponsor: null,
    location: null,
    imageUrl: null,
    hours: null,
    capacity: null,
    appliedCount: null,
    startAt,
    endAt,
    applyStartAt: null,
    applyEndAt: null,
    isActive: false,
    sourceMissing: false,
    lastSeenAt: null,
    createdAt: null,
    activityLevel: null,
    module: null,
    form: null,
    grades: null,
    sponsor: null,
    contactName: null,
    contactTel: null,
    duration: null,
    serviceHour: null,
    sumHours: null,
    sumPersons: null,
    partakeNum: null,
    favCount: null,
    limitNum: null,
    createdAtUpstream: null,
    auditedAt: null,
    updatedAtUpstream: null,
    places: null,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetLocalTimeZone();
});

describe("Young calendar", () => {
  it("builds Shanghai Sunday based ranges and preserves day deep links", () => {
    expect(youngCalendarRange("week", "2026-09-16")).toEqual({
      start: "2026-09-13",
      end: "2026-09-19",
    });
    expect(youngCalendarRange("month", "2026-09-16")).toEqual({
      start: "2026-08-30",
      end: "2026-10-03",
    });
    expect(youngCalendarPreviousDate("week", "2026-09-16")).toBe("2026-09-09");
    expect(youngCalendarNextDate("month", "2026-09-16")).toBe("2026-10-16");
  });

  it("normalizes invalid deep link dates and includes every overlapping event", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T18:00:00Z"));
    expect(normalizeYoungCalendarDate("invalid")).toBe("2026-09-10");
    const days = youngCalendarDays(
      "day",
      { start: "2026-09-10", end: "2026-09-10" },
      [
        event(
          "before",
          "2026-09-09T23:00:00+08:00",
          "2026-09-10T01:00:00+08:00",
        ),
        event(
          "after",
          "2026-09-10T23:00:00+08:00",
          "2026-09-11T01:00:00+08:00",
        ),
        event("missing-end", "2026-09-10T12:00:00+08:00", null),
        event("unknown", null, "2026-09-10T01:00:00+08:00"),
      ],
      new Date("2026-09-10T04:00:00.000Z"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]?.events.map(({ youngId }) => youngId)).toEqual([
      "missing-end",
      "after",
      "before",
    ]);
    expect(days[0]?.isToday).toBe(true);
  });

  it("young-event.web-calendar-density", () => {
    expect(youngCalendarRange("week", "2026-09-16")).toEqual({
      start: "2026-09-13",
      end: "2026-09-19",
    });
    const days = youngCalendarDays(
      "day",
      { start: "2026-09-10", end: "2026-09-10" },
      [
        event(
          "before",
          "2026-09-09T23:00:00+08:00",
          "2026-09-10T01:00:00+08:00",
        ),
        event(
          "after",
          "2026-09-10T23:00:00+08:00",
          "2026-09-11T01:00:00+08:00",
        ),
        event("missing-end", "2026-09-10T12:00:00+08:00", null),
      ],
      new Date("2026-09-10T04:00:00.000Z"),
    );
    expect(days[0]?.events.map(({ youngId }) => youngId)).toEqual([
      "missing-end",
      "after",
      "before",
    ]);
  });

  it("does not duplicate an event that ends at the next midnight", () => {
    const days = youngCalendarDays(
      "day",
      { start: "2026-09-10", end: "2026-09-11" },
      [
        event(
          "midnight-end",
          "2026-09-10T23:00:00+08:00",
          "2026-09-11T00:00:00+08:00",
        ),
      ],
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(days[0]?.events.map(({ youngId }) => youngId)).toEqual([
      "midnight-end",
    ]);
    expect(days[1]?.events).toEqual([]);
  });

  it("treats only the Shanghai start date as the day an event begins", () => {
    const ongoing = event(
      "ongoing",
      "2026-09-01T00:00:00+08:00",
      "2026-09-30T23:00:00+08:00",
    );
    const starting = event(
      "starting",
      "2026-09-27T08:00:00+08:00",
      "2026-09-27T10:00:00+08:00",
    );
    const days = youngCalendarDays(
      "month",
      { start: "2026-09-01", end: "2026-09-30" },
      [ongoing, starting],
      new Date("2026-09-01T00:00:00+08:00"),
    );
    expect(days[0].startingEvents).toEqual([ongoing]);
    expect(days[26].startingEvents).toEqual([starting]);
    expect(days[26].events).toEqual([starting, ongoing]);
  });

  it("marks the days outside the anchor month as muted", () => {
    const range = youngCalendarRange("month", "2026-09-16");
    const days = youngCalendarDays(
      "month",
      range,
      [],
      new Date("2026-09-01T00:00:00.000Z"),
      "activity",
      "2026-09-16",
    );
    expect(days.find((day) => day.key === "2026-08-30")?.isMuted).toBe(true);
    expect(days.find((day) => day.key === "2026-09-01")?.isMuted).toBe(false);
    expect(days.find((day) => day.key === "2026-10-03")?.isMuted).toBe(true);
  });

  it("places events by registration dates when requested", () => {
    const registrationEvent = event("registration", null, null);
    registrationEvent.applyStartAt = "2026-09-10T00:00:00+08:00";
    registrationEvent.applyEndAt = "2026-09-10T02:00:00+08:00";
    const days = youngCalendarDays(
      "day",
      { start: "2026-09-10", end: "2026-09-10" },
      [registrationEvent],
      new Date("2026-09-01T00:00:00.000Z"),
      "registration",
    );
    expect(days[0]?.events.map(({ youngId }) => youngId)).toEqual([
      "registration",
    ]);
  });

  it.each([
    ["2024-01-31", "2024-02-29"],
    ["2023-01-31", "2023-02-28"],
    ["2026-12-31", "2027-01-31"],
  ])("constrains the next month from %s to %s", (anchor, next) => {
    expect(youngCalendarNextDate("month", anchor)).toBe(next);
  });

  it("preserves leap days and year boundaries for ranges and previous navigation", () => {
    expect(youngCalendarPreviousDate("month", "2024-03-31")).toBe("2024-02-29");
    expect(youngCalendarPreviousDate("day", "2027-01-01")).toBe("2026-12-31");
    expect(youngCalendarNextDate("day", "2024-02-28")).toBe("2024-02-29");
    expect(youngCalendarRange("month", "2024-02-29")).toEqual({
      start: "2024-01-28",
      end: "2024-03-02",
    });
    const range = youngCalendarRange("month", "2026-12-31");
    expect(range).toEqual({ start: "2026-11-29", end: "2027-01-02" });
    const days = youngCalendarDays(
      "month",
      range,
      [],
      new Date("2026-12-31T12:00:00+08:00"),
      "activity",
      "2026-12-31",
    );
    const weeks = youngCalendarWeeks(days);
    expect(weeks.map((week) => week.days.length)).toEqual([7, 7, 7, 7, 7]);
    expect(weeks[0].days[0].key).toBe("2026-11-29");
    expect(weeks[4].days[6].key).toBe("2027-01-02");
    expect(days.find((day) => day.key === "2026-12-31")?.isToday).toBe(true);
    expect(days.find((day) => day.key === "2027-01-01")?.isMuted).toBe(true);
  });

  it.each([
    null,
    undefined,
    "",
    "not-a-date",
    "0000-01-01",
    "2026-2-03",
    "2026-02-30",
    "2026-13-01",
  ])("uses Shanghai today for invalid date %s", (value) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
    expect(normalizeYoungCalendarDate(value)).toBe("2027-01-01");
  });

  it.each(["day", "week", "month"] as const)(
    "keeps %s navigation and ranges within CE dates",
    (view) => {
      const range = youngCalendarRange(view, "0001-01-01");
      expect(range).toEqual({
        start: "0001-01-01",
        end:
          view === "day"
            ? "0001-01-01"
            : view === "week"
              ? "0001-01-06"
              : "0001-02-03",
      });
      expect(youngCalendarPreviousDate(view, "0001-01-01")).toBe("0001-01-01");
      expect(normalizeYoungCalendarDate(range.start)).toBe(range.start);
      const days = youngCalendarDays(
        view,
        range,
        [],
        new Date("2026-10-10T00:00:00Z"),
      );
      expect(days).toHaveLength(view === "day" ? 1 : view === "week" ? 6 : 34);
      expect(days[0].key).toBe("0001-01-01");
      expect(days.at(-1)?.key).toBe(range.end);
    },
  );

  it("includes the final supported calendar day without looping past it", () => {
    const item = event("last-day", "9999-12-31T12:00:00+08:00", null);
    const days = youngCalendarDays(
      "day",
      { start: "9999-12-31", end: "9999-12-31" },
      [item],
      new Date("2026-10-10T00:00:00Z"),
    );
    expect(days).toHaveLength(1);
    expect(days[0].events).toEqual([item]);
  });

  it.each(["UTC", "America/Los_Angeles", "Europe/Berlin"])(
    "keeps Shanghai boundaries when the runtime timezone is %s",
    (timezone) => {
      vi.stubEnv("TZ", timezone);
      resetLocalTimeZone();
      const days = youngCalendarDays(
        "day",
        { start: "2026-09-10", end: "2026-09-11" },
        [
          event("midnight", "2026-09-09T16:00:00Z", "2026-09-09T16:00:00Z"),
          event("missing-end", "2026-09-10T08:00:00Z", null),
          event("next-day", "2026-09-10T16:00:00Z", null),
        ],
        new Date("2026-09-10T17:00:00Z"),
      );
      expect(days[0].date.toISOString()).toBe("2026-09-09T16:00:00.000Z");
      expect(days[0].events.map((item) => item.youngId)).toEqual([
        "midnight",
        "missing-end",
      ]);
      expect(days[1].events.map((item) => item.youngId)).toEqual(["next-day"]);
      expect(days[0].isToday).toBe(false);
      expect(days[1].isToday).toBe(true);
    },
  );

  it("orders same-time starts by ID and keeps continuing registrations out of starting events", () => {
    const records = ["b", "a", "ongoing"].map((id) => ({
      ...event(id, "2026-08-01T00:00:00+08:00", null),
      applyStartAt:
        id === "ongoing"
          ? "2026-09-09T00:00:00+08:00"
          : "2026-09-10T09:00:00+08:00",
      applyEndAt: "2026-09-11T00:00:00+08:00",
    }));
    const days = youngCalendarDays(
      "day",
      { start: "2026-09-10", end: "2026-09-11" },
      records,
      new Date("2026-09-10T12:00:00+08:00"),
      "registration",
    );
    expect(days[0].events.map((item) => item.youngId)).toEqual([
      "a",
      "b",
      "ongoing",
    ]);
    expect(days[0].startingEvents.map((item) => item.youngId)).toEqual([
      "a",
      "b",
    ]);
    expect(days[1].events).toEqual([]);
  });
});

describe("calendar browsing hierarchy", () => {
  it("titles month, week and day views with their matching range", () => {
    expect(youngCalendarHeading("month", "2026-09-25", "en-us")).toBe(
      "September 2026",
    );
    expect(youngCalendarHeading("day", "2026-09-25", "en-us")).toContain(
      "Friday, September 25, 2026",
    );
    const week = youngCalendarHeading("week", "2026-09-25", "en-us");
    expect(week).toContain("20");
    expect(week).toContain("26");
    expect(week).toContain("2026");
  });
  it("starts the mobile month agenda at the selected day and retains all earlier month dates", () => {
    const range = youngCalendarRange("month", "2026-09-25");
    const days = youngCalendarDays(
      "month",
      range,
      [],
      new Date("2026-09-25T12:00:00+08:00"),
      "activity",
      "2026-09-25",
    );
    const agenda = youngCalendarAgenda(days, "2026-09-25");
    expect(agenda.current[0].key).toBe("2026-09-25");
    expect(agenda.earlier[0].key).toBe("2026-09-01");
    expect(agenda.earlier.at(-1)?.key).toBe("2026-09-24");
    expect([...agenda.earlier, ...agenda.current]).toHaveLength(30);
    expect(agenda.current.at(-1)?.key).toBe("2026-09-30");
  });
});
