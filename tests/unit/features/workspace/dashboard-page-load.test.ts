import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPrismaMock,
  loadSignedDashboardPageDataMock,
  resolveAuthoritativeRecentSessionMock,
  writeDashboardStageAnalyticsMock,
} = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  loadSignedDashboardPageDataMock: vi.fn(),
  resolveAuthoritativeRecentSessionMock: vi.fn(),
  writeDashboardStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/features/workspace/server/dashboard-page-copy", () => ({
  getDashboardPageCopy: () => ({
    dashboard: {
      nav: {
        calendar: {
          title: "Calendar",
        },
        exams: {
          title: "Exams",
        },
        homeworks: {
          title: "Homework",
        },
        subscriptions: {
          title: "Subscriptions",
        },
      },
    },
  }),
}));

vi.mock("@/features/workspace/server/dashboard-page-load-signed", () => ({
  loadSignedDashboardPageData: loadSignedDashboardPageDataMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: getPrismaMock,
}));

vi.mock("@/lib/auth/recent-session", () => ({
  resolveAuthoritativeRecentSession: resolveAuthoritativeRecentSessionMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeDashboardStageAnalytics: writeDashboardStageAnalyticsMock,
}));

import { loadSignedDashboardPage } from "@/features/workspace/server/dashboard-page-load";

describe("signed dashboard page load", () => {
  beforeEach(() => {
    getPrismaMock.mockReset();
    loadSignedDashboardPageDataMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockReset();
    writeDashboardStageAnalyticsMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("loads only signed tab data and its accessible content label", async () => {
    loadSignedDashboardPageDataMock.mockResolvedValue({
      marker: "signed-homeworks",
      signedIn: true,
      tab: "homeworks",
    });
    const url = new URL(
      "https://example.test/workspace/homeworks?tab=calendar&homeworkView=list",
    );

    const result = await loadSignedDashboardPage({
      locals: {
        locale: "en-us",
        requestId: "request-1",
      },
      request: new Request(url),
      tab: "homeworks",
      url,
      userId: "user-1",
    });

    expect(getPrismaMock).not.toHaveBeenCalled();
    expect(loadSignedDashboardPageDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pageCopy: expect.any(Object),
        requestId: "request-1",
        revealCalendarFeed: false,
        tab: "homeworks",
        userId: "user-1",
      }),
    );
    expect(url.href).toBe(
      "https://example.test/workspace/homeworks?tab=calendar&homeworkView=list",
    );
    expect(result).toEqual({
      mainContentLabel: "Homework",
      marker: "signed-homeworks",
      signedIn: true,
      tab: "homeworks",
    });
  });

  it("verifies the recent session only for feed-token tabs", async () => {
    loadSignedDashboardPageDataMock.mockResolvedValue({
      marker: "signed-calendar",
      signedIn: true,
      tab: "calendar",
    });
    const url = new URL("https://example.test/workspace/calendar");

    await loadSignedDashboardPage({
      locals: {
        locale: "en-us",
        requestId: "request-2",
      },
      request: new Request(url),
      tab: "calendar",
      url,
      userId: "user-1",
    });

    expect(resolveAuthoritativeRecentSessionMock).toHaveBeenCalledWith(
      expect.any(Headers),
      { expectedUserId: "user-1" },
    );
    expect(loadSignedDashboardPageDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ revealCalendarFeed: true, tab: "calendar" }),
    );
    expect(writeDashboardStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbContext: "none",
        dbLabel: "auth",
        dbQueryCount: 1,
        dbTransactionCount: 0,
        outcome: "success",
        stage: "recent_session",
      }),
    );
  });
});
