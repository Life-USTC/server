import { describe, expect, it, vi } from "vitest";

const {
  getDashboardUserContextMock,
  loadSignedDashboardTabDataMock,
  withLocalizedUserDbContextMock,
} = vi.hoisted(() => ({
  getDashboardUserContextMock: vi.fn(),
  loadSignedDashboardTabDataMock: vi.fn(),
  withLocalizedUserDbContextMock: vi.fn(
    async (_locale: string, _userId: string, action: () => Promise<unknown>) =>
      action(),
  ),
}));

vi.mock("@/features/dashboard/server/dashboard-overview-data", () => ({
  getDashboardUserContext: getDashboardUserContextMock,
}));

vi.mock("@/features/dashboard/server/dashboard-page-tab-data", () => ({
  loadSignedDashboardTabData: loadSignedDashboardTabDataMock,
  timeDashboardStage: vi.fn(
    async (_stage: string, _input: unknown, action: () => Promise<unknown>) =>
      action(),
  ),
}));

vi.mock("@/lib/db/prisma", () => ({
  withLocalizedUserDbContext: withLocalizedUserDbContextMock,
}));

import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";

describe("signed dashboard RLS reuse", () => {
  it("loads user context, nav, and overview inside one localized transaction", async () => {
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

    expect(withLocalizedUserDbContextMock).toHaveBeenCalledOnce();
    expect(withLocalizedUserDbContextMock).toHaveBeenCalledWith(
      "en-us",
      "user-1",
      expect.any(Function),
    );
    expect(getDashboardUserContextMock).toHaveBeenCalledOnce();
    expect(loadSignedDashboardTabDataMock).toHaveBeenCalledOnce();
  });
});
