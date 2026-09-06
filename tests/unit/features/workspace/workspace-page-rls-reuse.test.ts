import { describe, expect, it, vi } from "vitest";

const { getWorkspaceUserContextMock, loadSignedWorkspaceTabDataMock } =
  vi.hoisted(() => ({
    getWorkspaceUserContextMock: vi.fn(),
    loadSignedWorkspaceTabDataMock: vi.fn(),
  }));

vi.mock("@/features/workspace/server/workspace-overview-data", () => ({
  getWorkspaceUserContext: getWorkspaceUserContextMock,
}));

vi.mock("@/features/workspace/server/workspace-page-tab-data", () => ({
  loadSignedWorkspaceTabData: loadSignedWorkspaceTabDataMock,
  timeWorkspaceStage: vi.fn(
    async (_stage: string, _input: unknown, action: () => Promise<unknown>) =>
      action(),
  ),
}));

import { loadSignedWorkspacePageData } from "@/features/workspace/server/workspace-page-load-signed";

describe("signed workspace RLS boundaries", () => {
  it("loads the shell context before independent tab read models", async () => {
    const context = {
      sectionIds: [12],
      subscribedSections: [{ id: 12, retiredAt: null, semesterId: 1 }],
      user: {
        calendarFeedToken: null,
        id: "user-1",
        name: "User",
        username: "user",
      },
    };
    getWorkspaceUserContextMock.mockResolvedValue(context);
    loadSignedWorkspaceTabDataMock.mockResolvedValue({
      bus: null,
      calendarSubscriptionUrl: null,
      homeworks: null,
      links: null,
      navStats: {},
      overview: null,
      subscriptions: null,
      todos: [],
    });

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

    expect(getWorkspaceUserContextMock).toHaveBeenCalledOnce();
    expect(loadSignedWorkspaceTabDataMock).toHaveBeenCalledOnce();
  });
});
