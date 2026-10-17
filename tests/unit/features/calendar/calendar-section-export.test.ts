import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSectionMock, getSectionsMock } = vi.hoisted(() => ({
  getSectionMock: vi.fn(),
  getSectionsMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-export-data", () => ({
  getSectionForCalendar: getSectionMock,
  getSectionsForCalendar: getSectionsMock,
}));

vi.mock("@/features/calendar/server/ical", () => ({
  createMultiSectionCalendar: vi.fn(async () => ({
    toString: (): string => "BEGIN:VCALENDAR:MULTI",
  })),
  createSectionCalendar: vi.fn(async () => ({
    toString: (): string => "BEGIN:VCALENDAR:ONE",
  })),
}));

import {
  buildSectionCalendarExport,
  buildSectionsCalendarExport,
} from "@/features/calendar/server/calendar-section-export";
import {
  MAX_MULTI_SECTION_CALENDAR_IDS,
  normalizeSectionCalendarIds,
} from "@/features/calendar/server/calendar-section-ids";

describe("section calendar exports", () => {
  beforeEach(() => {
    getSectionMock.mockReset();
    getSectionsMock.mockReset();
  });

  it("normalizes IDs to a unique ascending set within the bound", () => {
    expect(normalizeSectionCalendarIds([3, 1, 3])).toEqual([1, 3]);
    const over = Array.from(
      { length: MAX_MULTI_SECTION_CALENDAR_IDS + 1 },
      (_, index) => index + 1,
    );
    expect(normalizeSectionCalendarIds(over)).toBeNull();
    expect(normalizeSectionCalendarIds([...over.slice(1), 2])).toHaveLength(
      MAX_MULTI_SECTION_CALENDAR_IDS,
    );
  });

  it("returns null when no sections match", async () => {
    getSectionsMock.mockResolvedValue([]);
    getSectionMock.mockResolvedValue(null);

    await expect(buildSectionsCalendarExport([1])).resolves.toBeNull();
    await expect(buildSectionCalendarExport(1)).resolves.toBeNull();
  });

  it("names and caches the single-section export", async () => {
    getSectionMock.mockResolvedValue({ code: "MATH1", semesterId: 7 });

    await expect(buildSectionCalendarExport(1)).resolves.toEqual({
      cacheControl: "public, max-age=3600",
      filename: "life-ustc-7-MATH1.ics",
      text: "BEGIN:VCALENDAR:ONE",
    });
  });

  it("names and caches the multi-section export", async () => {
    getSectionsMock.mockResolvedValue([{ id: 1 }]);

    await expect(buildSectionsCalendarExport([1])).resolves.toEqual({
      cacheControl: "public, max-age=3600",
      filename: "life-ustc-schedule.ics",
      text: "BEGIN:VCALENDAR:MULTI",
    });
  });
});
