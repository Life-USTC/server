import { describe, expect, it } from "vitest";
import { findCalendarBaseMonth } from "@/features/section-detail/lib/calendar";
import {
  calendarMonthDays,
  dateKey,
  formatDate,
  isSameMonth,
} from "@/features/section-detail/lib/date-display";

describe("section detail date display", () => {
  it("derives calendar keys with campus date boundaries", () => {
    const boundary = new Date("2026-03-01T16:00:00.000Z");
    const campusFormatted = new Intl.DateTimeFormat(undefined, {
      timeZone: "Asia/Shanghai",
    }).format(boundary);

    expect(dateKey(new Date("2026-03-01T15:59:59.000Z"))).toBe("2026-03-01");
    expect(dateKey(boundary)).toBe("2026-03-02");
    expect(formatDate(boundary, "n/a")).toBe(campusFormatted);
  });

  it("builds section month grid keys from the shared Sunday week policy", () => {
    const monthStart = findCalendarBaseMonth([
      {
        badges: [],
        date: "2026-03-01T16:00:00.000Z",
        dateKey: "2026-03-02",
        details: [],
        id: "event-1",
        kind: "class",
        meta: "",
        sortValue: 0,
        title: "Class",
      },
    ]);
    const days = calendarMonthDays(monthStart);
    const firstDay = days[0];
    const lastDay = days.at(-1);

    if (!firstDay || !lastDay) {
      throw new Error("Expected section month grid days");
    }

    expect(days).toHaveLength(42);
    expect(dateKey(monthStart)).toBe("2026-03-01");
    expect(dateKey(firstDay)).toBe("2026-03-01");
    expect(dateKey(days[1])).toBe("2026-03-02");
    expect(dateKey(lastDay)).toBe("2026-04-11");
    expect(isSameMonth(firstDay, monthStart)).toBe(true);
    expect(isSameMonth(lastDay, monthStart)).toBe(false);
  });
});
