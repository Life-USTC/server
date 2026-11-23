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
        cacheControl: "private, no-store",
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

  it("honors the feed modification date only without a stronger validator", async () => {
    const date = "Sun, 07 Jun 2026 00:00:00 GMT";
    getCachedExportMock.mockResolvedValue({
      calendar: {
        cacheControl: "private, no-store",
        etag: '"feed"',
        filename: "feed.ics",
        text: "calendar",
        contentModifiedAtMs: Date.parse(date),
      },
    });
    const { generateUserCalendarAction } = await import(
      "@/lib/api/routes/calendar-route-actions"
    );
    const read = (headers: Record<string, string>) =>
      generateUserCalendarAction(
        "user-1",
        new Request("https://example.test", { headers }),
      );
    const hit = await read({ "If-Modified-Since": date });
    expect(hit.status).toBe(304);
    expect(await hit.text()).toBe("");
    expect(hit.headers.get("Last-Modified")).toBe(date);
    expect(
      (await read({ "If-None-Match": '"old"', "If-Modified-Since": date }))
        .status,
    ).toBe(200);
    expect((await read({ "If-Modified-Since": "invalid" })).status).toBe(200);
  });

  it("loads heavy calendar data only through the cache miss builder", async () => {
    const user = { id: "user-1", sectionSubscriptions: [], todos: [] };
    getUserRecordMock.mockResolvedValue(user);
    buildUserCalendarExportMock.mockResolvedValue({
      cacheControl: "private, no-store",
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
