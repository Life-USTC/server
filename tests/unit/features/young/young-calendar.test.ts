import { describe, expect, it } from "vitest";
import {
  normalizeYoungCalendarDate,
  youngCalendarDays,
  youngCalendarNextDate,
  youngCalendarPreviousDate,
  youngCalendarRange,
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

describe("Young calendar", () => {
  it("builds Shanghai Monday based ranges and preserves day deep links", () => {
    expect(youngCalendarRange("week", "2026-09-16")).toEqual({
      start: "2026-09-14",
      end: "2026-09-20",
    });
    expect(youngCalendarRange("month", "2026-09-16")).toEqual({
      start: "2026-08-31",
      end: "2026-10-04",
    });
    expect(youngCalendarPreviousDate("week", "2026-09-16")).toBe("2026-09-09");
    expect(youngCalendarNextDate("month", "2026-09-16")).toBe("2026-10-16");
  });

  it("normalizes invalid deep link dates and includes every overlapping event", () => {
    expect(normalizeYoungCalendarDate("invalid")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
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
      "before",
      "missing-end",
      "after",
    ]);
    expect(days[0]?.isToday).toBe(true);
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
    expect(days.find((day) => day.key === "2026-08-31")?.isMuted).toBe(true);
    expect(days.find((day) => day.key === "2026-09-01")?.isMuted).toBe(false);
    expect(days.find((day) => day.key === "2026-10-04")?.isMuted).toBe(true);
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
});
