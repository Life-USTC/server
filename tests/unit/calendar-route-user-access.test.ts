import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessRecordMock, resolveApiUserIdMock } = vi.hoisted(() => ({
  getAccessRecordMock: vi.fn(),
  resolveApiUserIdMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-export-data", () => ({
  getUserCalendarAccessRecord: getAccessRecordMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiUserId: resolveApiUserIdMock,
}));

describe("personal calendar access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the current feed token before returning a cache identity", async () => {
    getAccessRecordMock.mockResolvedValue({
      id: "user-1",
      calendarFeedToken: "current-token",
    });
    const { resolveUserCalendarAccess } = await import(
      "@/lib/api/routes/calendar-route-user-access"
    );

    const access = await resolveUserCalendarAccess({
      rawUserId: "user-1",
      request: new Request(
        "https://example.test/api/users/user-1/calendar.ics?token=current-token",
      ),
    });

    expect(access).toEqual({ ok: true, userId: "user-1" });
    expect(resolveApiUserIdMock).not.toHaveBeenCalled();
  });

  it("rejects a revoked token before any rendered cache can be read", async () => {
    getAccessRecordMock.mockResolvedValue({
      id: "user-1",
      calendarFeedToken: "replacement-token",
    });
    const { resolveUserCalendarAccess } = await import(
      "@/lib/api/routes/calendar-route-user-access"
    );

    const access = await resolveUserCalendarAccess({
      rawUserId: "user-1",
      request: new Request(
        "https://example.test/api/users/user-1/calendar.ics?token=revoked-token",
      ),
    });

    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.response.status).toBe(403);
    expect(resolveApiUserIdMock).not.toHaveBeenCalled();
  });
});
