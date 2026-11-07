import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerContextMock,
  getWorkspaceUserContextMock,
  loadSignedWorkspaceTabDataMock,
  serializeWorkspaceOverviewMock,
  timeWorkspaceStageMock,
} = vi.hoisted(() => ({
  getViewerContextMock: vi.fn(),
  getWorkspaceUserContextMock: vi.fn(),
  loadSignedWorkspaceTabDataMock: vi.fn(),
  serializeWorkspaceOverviewMock: vi.fn(),
  timeWorkspaceStageMock: vi.fn(
    async (...args: [string, unknown, () => Promise<unknown>, unknown?]) =>
      args[2](),
  ),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-data", () => ({
  getWorkspaceUserContext: getWorkspaceUserContextMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-serialization", () => ({
  serializeWorkspaceOverview: serializeWorkspaceOverviewMock,
}));

vi.mock("@/features/workspace/server/workspace-page-tab-data", () => ({
  loadSignedWorkspaceTabData: loadSignedWorkspaceTabDataMock,
  timeWorkspaceStage: timeWorkspaceStageMock,
}));

import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";

describe("signed workspace tab observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceUserContextMock.mockResolvedValue({
      sectionIds: [12, 34],
    });
    loadSignedWorkspaceTabDataMock.mockResolvedValue({
      bus: null,
      calendarSubscriptionUrl: null,
      homeworks: null,
      links: null,
      navStats: null,
      overview: null,
      subscriptions: null,
      todos: null,
    });
  });

  it("records one unknown mixed-context tab stage for fan-out data", async () => {
    await loadSignedWorkspacePageData({
      calendarSemesterId: undefined,
      locale: "en-us",
      overviewWeek: null,
      pageCopy: {} as never,
      referenceNow: new Date("2026-05-22T10:30:00.000Z"),
      requestId: "request-1",
      tab: "overview",
      userId: "user-1",
    });

    const tabCall = timeWorkspaceStageMock.mock.calls.find(
      ([stage]) => stage === "tab",
    );
    expect(tabCall?.[3]).toEqual(
      expect.objectContaining({
        countState: "unknown",
        dbContext: "mixed",
        dbLabel: "app",
      }),
    );
    expect(
      timeWorkspaceStageMock.mock.calls.filter(([stage]) => stage === "tab"),
    ).toHaveLength(1);
  });

  it.each([false, true])(
    "projects authoritative homework capability for suspended=%s",
    async (isSuspended) => {
      getViewerContextMock.mockResolvedValue({
        isAuthenticated: true,
        isSuspended,
      });
      const result = await loadSignedWorkspacePageData({
        calendarSemesterId: undefined,
        locale: "en-us",
        overviewWeek: null,
        pageCopy: {} as never,
        referenceNow: undefined,
        requestId: undefined,
        tab: "homeworks",
        userId: "user-1",
      });
      expect(result).toMatchObject({
        homeworkCapabilities: {
          canComplete: true,
          canWriteShared: !isSuspended,
        },
      });
      expect(getViewerContextMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" }),
      );
    },
  );
});
