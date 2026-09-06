import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPrismaMock,
  loadSignedWorkspacePageDataMock,
  resolveAuthoritativeRecentSessionMock,
  writeWorkspaceStageAnalyticsMock,
} = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  loadSignedWorkspacePageDataMock: vi.fn(),
  resolveAuthoritativeRecentSessionMock: vi.fn(),
  writeWorkspaceStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/features/workspace/server/workspace-page-copy", () => ({
  getWorkspacePageCopy: () => ({
    workspace: {
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

vi.mock("@/features/workspace/server/workspace-page-load-signed", () => ({
  loadSignedWorkspacePageData: loadSignedWorkspacePageDataMock,
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
  writeWorkspaceStageAnalytics: writeWorkspaceStageAnalyticsMock,
}));

import { loadSignedWorkspacePage } from "@/features/workspace/server/workspace-page-load";

describe("signed workspace page load", () => {
  beforeEach(() => {
    getPrismaMock.mockReset();
    loadSignedWorkspacePageDataMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockReset();
    writeWorkspaceStageAnalyticsMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it("loads only signed tab data and its accessible content label", async () => {
    loadSignedWorkspacePageDataMock.mockResolvedValue({
      marker: "signed-homeworks",
      signedIn: true,
      tab: "homeworks",
    });
    const url = new URL(
      "https://example.test/workspace/homeworks?tab=calendar&homeworkView=list",
    );

    const result = await loadSignedWorkspacePage({
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
    expect(loadSignedWorkspacePageDataMock).toHaveBeenCalledWith(
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
    loadSignedWorkspacePageDataMock.mockResolvedValue({
      marker: "signed-calendar",
      signedIn: true,
      tab: "calendar",
    });
    const url = new URL("https://example.test/workspace/calendar");

    await loadSignedWorkspacePage({
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
    expect(loadSignedWorkspacePageDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ revealCalendarFeed: true, tab: "calendar" }),
    );
    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledWith(
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
