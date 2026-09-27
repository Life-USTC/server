import { afterEach, expect, it, vi } from "vitest";
import { resolveCalendarEventWindow } from "@/features/calendar/server/calendar-event-window";
import { parsePersonalCalendarRange } from "@/features/calendar/server/personal-calendar-range";

afterEach(() => vi.useRealTimers());

it("young-workspace.calendar", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-09-15T12:00:00+08:00"));
  const resolve = (dateFrom?: string, dateTo?: string) =>
    resolveCalendarEventWindow(
      parsePersonalCalendarRange({ dateFrom, dateTo }),
    );
  const day = resolve("2030-09-15", "2030-09-15");
  expect(day.windowStart.toISOString()).toBe("2030-09-14T16:00:00.000Z");
  expect(day.windowEnd.toISOString()).toBe("2030-09-15T16:00:00.000Z");
  expect(day.includeWindowEnd).toBe(false);
  for (const [from, to] of [
    ["2030-09-15T12:00:00+08:00", "2030-09-15T13:00:00+08:00"],
    ["2030-09-15T04:00:00Z", "2030-09-15T05:00:00Z"],
    ["2030-09-15T12:00:00", "2030-09-15T13:00:00"],
  ]) {
    const window = resolve(from, to);
    expect(window.windowStart.toISOString()).toBe("2030-09-15T04:00:00.000Z");
    expect(window.windowEnd.toISOString()).toBe("2030-09-15T05:00:00.000Z");
    expect(window.includeWindowEnd).toBe(true);
  }
  const defaultWindow = resolve();
  expect(defaultWindow.windowStart.toISOString()).toBe(
    "2030-09-14T16:00:00.000Z",
  );
  expect(defaultWindow.windowEnd.toISOString()).toBe(
    "2030-09-21T16:00:00.000Z",
  );
  expect(defaultWindow.includeWindowEnd).toBe(false);
  expect(() => resolve("2030-01-01", "2031-01-01")).not.toThrow();
  for (const bounds of [
    ["2030-09-15", undefined],
    [undefined, "2030-09-15"],
    ["", ""],
    ["invalid", "2030-09-15"],
    ["2030-09-15", "2030-09-14"],
    ["2030-01-01", "2031-01-02"],
  ])
    expect(() => resolve(...bounds)).toThrow();
});
