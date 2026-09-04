import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  workspaceSubscriptionsMock,
  getCalendarSubscriptionUrlMock,
  getWorkspaceNavStatsMock,
  listSubscribedSectionsMock,
  semesterFindManyMock,
} = vi.hoisted(() => ({
  workspaceSubscriptionsMock: vi.fn(),
  getCalendarSubscriptionUrlMock: vi.fn(),
  getWorkspaceNavStatsMock: vi.fn(),
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
  withUserDbContext: vi.fn(
    async (_userId: string, action: () => Promise<unknown>) => action(),
  ),
}));

vi.mock("@/features/workspace/server/workspace-overview-data", () => ({
  getWorkspaceNavStats: getWorkspaceNavStatsMock,
  getWorkspaceOverviewData: vi.fn(),
  getWorkspaceSemesters: semesterFindManyMock,
}));

vi.mock("@/features/workspace/server/workspace-tab-data", () => ({
  getBusTabData: vi.fn(),
  getCalendarSubscriptionUrl: vi.fn(),
  getHomeworksTabData: vi.fn(),
  getSubscriptionsTabData: workspaceSubscriptionsMock,
  getTodosTabData: vi.fn(),
}));

vi.mock("@/features/catalog-links/server/catalog-link-data", () => ({
  getLinksTabData: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

import { getSubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";
import { loadSignedWorkspaceTabData } from "@/features/workspace/server/workspace-page-tab-data";

describe("workspace subscription calendar token reuse", () => {
  beforeEach(() => {
    workspaceSubscriptionsMock.mockReset().mockResolvedValue({});
    getCalendarSubscriptionUrlMock.mockReset().mockResolvedValue("/feed.ics");
    getWorkspaceNavStatsMock.mockReset().mockResolvedValue({});
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
  ])(
    "forwards %s without changing its semantics",
    async (_label, options, token) => {
      await getSubscriptionsTabData("user-1", "en-us", options);

      expect(getCalendarSubscriptionUrlMock).toHaveBeenCalledWith(
        "user-1",
        token,
      );
    },
  );

  it.each([
    ["subscriptions", false],
    ["exams", true],
  ])(
    "forwards the workspace context token for the %s tab",
    async (tab, includeExams) => {
      await loadSignedWorkspaceTabData({
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
        revealCalendarFeed: true,
        referenceNow: undefined,
        requestId: "request-1",
        tab,
        userId: "user-1",
      });

      expect(workspaceSubscriptionsMock).toHaveBeenCalledWith(
        "user-1",
        "en-us",
        {
          calendarFeedToken: "context-token",
          includeExams,
          sectionIds: [12],
        },
      );
    },
  );

  it("records the thrown error on a failed workspace stage", async () => {
    const { logAppEvent } = await import("@/lib/log/app-logger");
    const { timeWorkspaceStage } = await import(
      "@/features/workspace/server/workspace-page-tab-data"
    );
    const stageError = Object.assign(new Error("permission denied"), {
      code: "P2010",
      name: "PrismaClientKnownRequestError",
    });

    await expect(
      timeWorkspaceStage(
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
      "workspace.load.stage",
      expect.objectContaining({
        stage: "subscriptions",
        status: "error",
        subscribedSectionCount: 0,
      }),
      stageError,
    );
  });
});
