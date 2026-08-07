import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dashboardSubscriptionsMock,
  getCalendarSubscriptionUrlMock,
  getDashboardNavStatsMock,
  listSubscribedSectionsMock,
  semesterFindManyMock,
} = vi.hoisted(() => ({
  dashboardSubscriptionsMock: vi.fn(),
  getCalendarSubscriptionUrlMock: vi.fn(),
  getDashboardNavStatsMock: vi.fn(),
  listSubscribedSectionsMock: vi.fn(),
  semesterFindManyMock: vi.fn(),
}));

vi.mock(
  "@/features/subscriptions/server/subscription-calendar-read-model",
  () => ({
    getCalendarSubscriptionUrl: getCalendarSubscriptionUrlMock,
  }),
);

vi.mock("@/features/subscriptions/server/subscription-tab-sections", () => ({
  listSubscribedSectionsForSubscriptionsTab: listSubscribedSectionsMock,
  subscriptionSectionFromRow: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ semester: { findMany: semesterFindManyMock } }),
}));

vi.mock("@/features/dashboard/server/dashboard-overview-data", () => ({
  getDashboardNavStats: getDashboardNavStatsMock,
  getDashboardOverviewData: vi.fn(),
}));

vi.mock("@/features/dashboard/server/dashboard-tab-data", () => ({
  getBusTabData: vi.fn(),
  getCalendarSubscriptionUrl: vi.fn(),
  getHomeworksTabData: vi.fn(),
  getSubscriptionsTabData: dashboardSubscriptionsMock,
  getTodosTabData: vi.fn(),
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-data", () => ({
  getLinksTabData: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

import { loadSignedDashboardTabData } from "@/features/dashboard/server/dashboard-page-tab-data";
import { getSubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";

describe("dashboard subscription calendar token reuse", () => {
  beforeEach(() => {
    dashboardSubscriptionsMock.mockReset().mockResolvedValue({});
    getCalendarSubscriptionUrlMock.mockReset().mockResolvedValue("/feed.ics");
    getDashboardNavStatsMock.mockReset().mockResolvedValue({});
    listSubscribedSectionsMock.mockReset().mockResolvedValue([]);
    semesterFindManyMock.mockReset().mockResolvedValue([]);
  });

  it.each([
    [
      "existing token",
      { calendarFeedToken: "existing-token" },
      "existing-token",
    ],
    ["known null token", { calendarFeedToken: null }, null],
    ["unspecified token", undefined, undefined],
  ])("forwards %s without changing its semantics", async (_label, options, token) => {
    await getSubscriptionsTabData("user-1", "en-us", options);

    expect(getCalendarSubscriptionUrlMock).toHaveBeenCalledWith(
      "user-1",
      token,
    );
  });

  it.each([
    ["subscriptions", false],
    ["exams", true],
  ])("forwards the dashboard context token for the %s tab", async (tab, includeExams) => {
    await loadSignedDashboardTabData({
      calendarSemesterId: undefined,
      context: {
        sectionIds: [12],
        subscribedSections: [{ id: 12, semesterId: 1 }],
        user: {
          calendarFeedToken: "context-token",
          id: "user-1",
          name: "User",
          username: "user",
        },
      },
      locale: "en-us",
      referenceNow: undefined,
      requestId: "request-1",
      tab,
      userId: "user-1",
    });

    expect(dashboardSubscriptionsMock).toHaveBeenCalledWith("user-1", "en-us", {
      calendarFeedToken: "context-token",
      includeExams,
      sectionIds: [12],
    });
  });

  it("records the thrown error on a failed dashboard stage", async () => {
    const { logAppEvent } = await import("@/lib/log/app-logger");
    const { timeDashboardStage } = await import(
      "@/features/dashboard/server/dashboard-page-tab-data"
    );
    const stageError = Object.assign(new Error("permission denied"), {
      code: "P2010",
      name: "PrismaClientKnownRequestError",
    });

    await expect(
      timeDashboardStage(
        "subscriptions",
        {
          requestId: "request-1",
          subscribedSectionCount: 0,
          tab: "subscriptions",
        },
        async () => {
          throw stageError;
        },
      ),
    ).rejects.toBe(stageError);

    expect(logAppEvent).toHaveBeenCalledWith(
      "warn",
      "dashboard.load.stage",
      expect.objectContaining({
        stage: "subscriptions",
        status: "error",
        subscribedSectionCount: 0,
      }),
      stageError,
    );
  });
});
