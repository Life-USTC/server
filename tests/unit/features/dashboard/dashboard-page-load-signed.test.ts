import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDashboardUserContextMock,
  loadSignedDashboardTabDataMock,
  serializeDashboardOverviewMock,
  timeDashboardStageMock,
} = vi.hoisted(() => ({
  getDashboardUserContextMock: vi.fn(),
  loadSignedDashboardTabDataMock: vi.fn(),
  serializeDashboardOverviewMock: vi.fn(),
  timeDashboardStageMock: vi.fn(
    async (...args: [string, unknown, () => Promise<unknown>, unknown?]) =>
      args[2](),
  ),
}));

vi.mock("@/features/dashboard/server/dashboard-overview-data", () => ({
  getDashboardUserContext: getDashboardUserContextMock,
}));

vi.mock("@/features/dashboard/server/dashboard-overview-serialization", () => ({
  serializeDashboardOverview: serializeDashboardOverviewMock,
}));

vi.mock("@/features/dashboard/server/dashboard-page-tab-data", () => ({
  loadSignedDashboardTabData: loadSignedDashboardTabDataMock,
  timeDashboardStage: timeDashboardStageMock,
}));

import { loadSignedDashboardPageData } from "@/features/dashboard/server/dashboard-page-load-signed";

describe("signed dashboard tab observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardUserContextMock.mockResolvedValue({
      sectionIds: [12, 34],
    });
    loadSignedDashboardTabDataMock.mockResolvedValue({
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

    const tabCall = timeDashboardStageMock.mock.calls.find(
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
      timeDashboardStageMock.mock.calls.filter(([stage]) => stage === "tab"),
    ).toHaveLength(1);
  });
});
