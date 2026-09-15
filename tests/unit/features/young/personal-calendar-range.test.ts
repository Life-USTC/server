import { describe, expect, it } from "vitest";
import { resolveCalendarEventWindow } from "@/features/calendar/server/calendar-event-window";
import { parsePersonalCalendarRange } from "@/features/calendar/server/personal-calendar-range";

describe("personal calendar range shared by REST, GraphQL and MCP", () => {
  it("uses one complete Shanghai day for matching date-only bounds", () => {
    const range = resolveCalendarEventWindow(
      parsePersonalCalendarRange({
        dateFrom: "2030-09-15",
        dateTo: "2030-09-15",
      }),
    );
    expect(range.windowStart.toISOString()).toBe("2030-09-14T16:00:00.000Z");
    expect(range.windowEnd.toISOString()).toBe("2030-09-15T16:00:00.000Z");
    expect(range.includeWindowEnd).toBe(false);
  });
  it.each([
    { dateFrom: "2030-09-15" },
    { dateFrom: "invalid", dateTo: "2030-09-15" },
    { dateFrom: "2030-09-15", dateTo: "2030-09-14" },
    { dateFrom: "2030-01-01", dateTo: "2031-01-02" },
  ])(
    "rejects incomplete, invalid, reversed or oversized bounds: %j",
    (input) => {
      expect(() => parsePersonalCalendarRange(input)).toThrow();
    },
  );
  it("preserves offset instants and accepts up to 366 full days", () => {
    const range = resolveCalendarEventWindow(
      parsePersonalCalendarRange({
        dateFrom: "2030-09-15T12:00:00+08:00",
        dateTo: "2030-09-15T13:00:00+08:00",
      }),
    );
    expect(range.windowStart.toISOString()).toBe("2030-09-15T04:00:00.000Z");
    expect(range.includeWindowEnd).toBe(true);
    expect(() =>
      parsePersonalCalendarRange({
        dateFrom: "2030-01-01",
        dateTo: "2031-01-01",
      }),
    ).not.toThrow();
  });
});
