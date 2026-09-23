import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  logServerActionErrorMock,
  requireSettingsUserMock,
  rotateUserCalendarFeedTokenMock,
} = vi.hoisted(() => ({
  logServerActionErrorMock: vi.fn(),
  requireSettingsUserMock: vi.fn(),
  rotateUserCalendarFeedTokenMock: vi.fn(),
}));

vi.mock("@/features/settings/server/settings-page-data", () => ({
  requireSettingsUser: requireSettingsUserMock,
}));

vi.mock("@/features/subscriptions/server/calendar-feed-token", () => ({
  rotateUserCalendarFeedToken: rotateUserCalendarFeedTokenMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logServerActionError: logServerActionErrorMock,
}));

function request() {
  return new Request(
    "https://life.example/account/settings/security?/rotateCalendarToken",
    {
      method: "POST",
      headers: { cookie: "better-auth.session_token=session-token" },
    },
  );
}

describe("settings calendar token rotation action", () => {
  beforeEach(() => {
    vi.resetModules();
    requireSettingsUserMock.mockReset();
    rotateUserCalendarFeedTokenMock.mockReset();
    logServerActionErrorMock.mockReset();
    requireSettingsUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("redirects after rotating through the recent-auth service", async () => {
    rotateUserCalendarFeedTokenMock.mockResolvedValue({
      ok: true,
      token: "never-rendered",
    });
    const { rotateSettingsCalendarTokenAction } = await import(
      "@/features/settings/server/settings-security-actions"
    );
    const inputRequest = request();

    await expect(
      rotateSettingsCalendarTokenAction({
        locale: "en-us",
        request: inputRequest,
        requestId: "request-1",
        url: new URL(inputRequest.url),
      }),
    ).rejects.toMatchObject({
      location: "/account/settings/security?message=CalendarTokenRotated",
      status: 303,
    });
    expect(rotateUserCalendarFeedTokenMock).toHaveBeenCalledWith(
      "user-1",
      inputRequest.headers,
    );
  });

  it("returns recent-auth guidance without rotating on a stale session", async () => {
    rotateUserCalendarFeedTokenMock.mockResolvedValue({
      ok: false,
      reason: "session_not_fresh",
    });
    const { rotateSettingsCalendarTokenAction } = await import(
      "@/features/settings/server/settings-security-actions"
    );
    const inputRequest = request();

    const result = await rotateSettingsCalendarTokenAction({
      locale: "en-us",
      request: inputRequest,
      requestId: "request-1",
      url: new URL(inputRequest.url),
    });
    expect(result).toMatchObject({
      status: 403,
      data: { kind: "security" },
    });
  });

  it("fails closed and logs operational failures", async () => {
    rotateUserCalendarFeedTokenMock.mockRejectedValue(
      new Error("database unavailable"),
    );
    const { rotateSettingsCalendarTokenAction } = await import(
      "@/features/settings/server/settings-security-actions"
    );
    const inputRequest = request();

    const result = await rotateSettingsCalendarTokenAction({
      locale: "en-us",
      request: inputRequest,
      requestId: "request-1",
      url: new URL(inputRequest.url),
    });
    expect(result).toMatchObject({
      status: 500,
      data: { kind: "security" },
    });
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "settings.calendar-token.rotate.failed",
      expect.any(Error),
      expect.objectContaining({ requestId: "request-1" }),
    );
  });
});
