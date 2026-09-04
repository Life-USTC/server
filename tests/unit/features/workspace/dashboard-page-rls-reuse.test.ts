import { describe, expect, it, vi } from "vitest";

const { getDashboardUserContextMock, loadSignedDashboardTabDataMock } =
  vi.hoisted(() => ({
    getDashboardUserContextMock: vi.fn(),
    loadSignedDashboardTabDataMock: vi.fn(),
  }));

vi.mock("@/features/workspace/server/dashboard-overview-data", () => ({
  getDashboardUserContext: getDashboardUserContextMock,
}));

vi.mock("@/features/workspace/server/dashboard-page-tab-data", () => ({
  loadSignedDashboardTabData: loadSignedDashboardTabDataMock,
  timeDashboardStage: vi.fn(
    async (_stage: string, _input: unknown, action: () => Promise<unknown>) =>
      action(),
  ),
}));

import { loadSignedDashboardPageData } from "@/features/workspace/server/dashboard-page-load-signed";

describe("signed dashboard RLS boundaries", () => {
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
    getDashboardUserContextMock.mockResolvedValue(context);
    loadSignedDashboardTabDataMock.mockResolvedValue({
      bus: null,
      calendarSubscriptionUrl: null,
      homeworks: null,
      links: null,
      navStats: {},
      overview: null,
      subscriptions: null,
      todos: [],
    });

    await loadSignedDashboardPageData({
      calendarSemesterId: undefined,
      locale: "en-us",
      overviewWeek: null,
      pageCopy: {} as never,
      referenceNow: new Date("2026-05-22T10:30:00.000Z"),
      requestId: "request-1",
      tab: "overview",
      userId: "user-1",
    });

    expect(getDashboardUserContextMock).toHaveBeenCalledOnce();
    expect(loadSignedDashboardTabDataMock).toHaveBeenCalledOnce();
  });
});
