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
        "https://example.test/api/calendar-feeds/user-1.ics?token=current-token",
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
        "https://example.test/api/calendar-feeds/user-1.ics?token=revoked-token",
      ),
    });

    expect(access.ok).toBe(false);
    if (!access.ok) {
      expect(access.response.status).toBe(410);
      expect(access.response.headers.get("Cache-Control")).toBe(
        "private, max-age=60",
      );
    }
    expect(resolveApiUserIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown user even when a feed token is present", async () => {
    getAccessRecordMock.mockResolvedValue(null);
    const { resolveUserCalendarAccess } = await import(
      "@/lib/api/routes/calendar-route-user-access"
    );

    const access = await resolveUserCalendarAccess({
      rawUserId: "missing-user",
      request: new Request(
        "https://example.test/api/calendar-feeds/missing-user.ics?token=any-token",
      ),
    });

    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.response.status).toBe(404);
  });
});
