import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildUserCalendarExportMock, getCachedExportMock, getUserRecordMock } =
  vi.hoisted(() => ({
    buildUserCalendarExportMock: vi.fn(),
    getCachedExportMock: vi.fn(),
    getUserRecordMock: vi.fn(),
  }));

type BuiltCalendarExport = {
  cacheControl: string;
  filename: string;
  text: string;
};

vi.mock("@/features/calendar/server/calendar-export-cache", () => ({
  getCachedUserCalendarExport: getCachedExportMock,
  requestMatchesEtag: vi.fn(() => false),
}));

vi.mock("@/features/calendar/server/calendar-export-data", () => ({
  getSectionForCalendar: vi.fn(),
  getSectionsForCalendar: vi.fn(),
  getUserCalendarRecord: getUserRecordMock,
}));

vi.mock("@/features/calendar/server/calendar-export-service", () => ({
  buildUserCalendarExport: buildUserCalendarExportMock,
}));

vi.mock("@/features/calendar/server/ical", () => ({
  createMultiSectionCalendar: vi.fn(),
  createSectionCalendar: vi.fn(),
}));

describe("personal calendar route cache ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not load calendar relations when the rendered export is cached", async () => {
    getCachedExportMock.mockResolvedValue({
      calendar: {
        cacheControl: "private, max-age=300",
        etag: '"sha256-cached"',
        filename: "life-ustc-subscriptions.ics",
        text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
      },
      status: "fresh",
    });
    const { generateUserCalendarAction } = await import(
      "@/lib/api/routes/calendar-route-actions"
    );

    const response = await generateUserCalendarAction(
      "user-1",
      new Request("https://example.test"),
    );

    expect(response.status).toBe(200);
    expect(getUserRecordMock).not.toHaveBeenCalled();
    expect(buildUserCalendarExportMock).not.toHaveBeenCalled();
  });

  it("loads heavy calendar data only through the cache miss builder", async () => {
    const user = { id: "user-1", subscribedSections: [], todos: [] };
    getUserRecordMock.mockResolvedValue(user);
    buildUserCalendarExportMock.mockResolvedValue({
      cacheControl: "private, max-age=300",
      filename: "life-ustc-subscriptions.ics",
      text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });
    getCachedExportMock.mockImplementation(
      async (_userId: string, build: () => Promise<unknown>) => {
        const calendar = (await build()) as BuiltCalendarExport;
        return {
          calendar: {
            ...calendar,
            etag: '"sha256-built"',
          },
          status: "miss",
        };
      },
    );
    const { generateUserCalendarAction } = await import(
      "@/lib/api/routes/calendar-route-actions"
    );

    await generateUserCalendarAction(
      "user-1",
      new Request("https://example.test"),
    );

    expect(getUserRecordMock).toHaveBeenCalledOnce();
    expect(buildUserCalendarExportMock).toHaveBeenCalledWith(user, "user-1");
  });
});
