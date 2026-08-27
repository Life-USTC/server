import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getBusTabDataMock,
  getCalendarSubscriptionUrlMock,
  getDashboardNavStatsMock,
  getDashboardOverviewDataMock,
  getDashboardSemestersMock,
  getHomeworksTabDataMock,
  getLinksTabDataMock,
  getSubscriptionsTabDataMock,
  getTodosTabDataMock,
} = vi.hoisted(() => ({
  getBusTabDataMock: vi.fn(),
  getCalendarSubscriptionUrlMock: vi.fn(),
  getDashboardNavStatsMock: vi.fn(),
  getDashboardOverviewDataMock: vi.fn(),
  getDashboardSemestersMock: vi.fn(),
  getHomeworksTabDataMock: vi.fn(),
  getLinksTabDataMock: vi.fn(),
  getSubscriptionsTabDataMock: vi.fn(),
  getTodosTabDataMock: vi.fn(),
}));

vi.mock("@/features/dashboard/server/dashboard-overview-data", () => ({
  getDashboardNavStats: getDashboardNavStatsMock,
  getDashboardOverviewData: getDashboardOverviewDataMock,
  getDashboardSemesters: getDashboardSemestersMock,
}));

vi.mock("@/features/dashboard/server/dashboard-tab-data", () => ({
  getBusTabData: getBusTabDataMock,
  getCalendarSubscriptionUrl: getCalendarSubscriptionUrlMock,
  getHomeworksTabData: getHomeworksTabDataMock,
  getSubscriptionsTabData: getSubscriptionsTabDataMock,
  getTodosTabData: getTodosTabDataMock,
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-data", () => ({
  getLinksTabData: getLinksTabDataMock,
}));

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
const { withUserDbContextMock } = vi.hoisted(() => ({
  withUserDbContextMock: vi.fn(
    async (_userId: string, action: () => Promise<unknown>) => action(),
  ),
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import { loadSignedDashboardTabData } from "@/features/dashboard/server/dashboard-page-tab-data";

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

function loadTab(tab: string) {
  return loadSignedDashboardTabData({
    calendarSemesterId: undefined,
    context,
    locale: "en-us",
    referenceNow: undefined,
    requestId: "request-1",
    tab,
    userId: "user-1",
  });
}

describe("dashboard todo count reuse and RLS fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardOverviewDataMock.mockResolvedValue({});
    getDashboardSemestersMock.mockResolvedValue([
      {
        id: 1,
        nameCn: "2026春",
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    getLinksTabDataMock.mockResolvedValue({});
  });

  it.each(["overview", "todos"])(
    "uses one todo read for the %s tab and derives the nav count",
    async (tab) => {
      let resolveTodos: (value: Array<{ completed: boolean }>) => void = () =>
        undefined;
      const todosPromise = new Promise<Array<{ completed: boolean }>>(
        (resolve) => {
          resolveTodos = resolve;
        },
      );
      getTodosTabDataMock.mockReturnValue(todosPromise);
      getDashboardNavStatsMock.mockImplementation(
        (
          _user,
          _sections,
          _referenceNow,
          pendingTodosCount: Promise<number> | undefined,
        ) =>
          pendingTodosCount?.then((count) => ({ pendingTodosCount: count })) ??
          Promise.resolve({ pendingTodosCount: 99 }),
      );

      const resultPromise = loadTab(tab);

      await vi.waitFor(() => {
        expect(getTodosTabDataMock).toHaveBeenCalledOnce();
        expect(getDashboardNavStatsMock).toHaveBeenCalledOnce();
      });
      expect(getDashboardOverviewDataMock).not.toHaveBeenCalled();
      expect(withUserDbContextMock).not.toHaveBeenCalled();

      resolveTodos([
        { completed: false },
        { completed: true },
        { completed: false },
      ]);

      await expect(resultPromise).resolves.toMatchObject({
        navStats: { pendingTodosCount: 2 },
        todos: [
          { completed: false },
          { completed: true },
          { completed: false },
        ],
      });
      expect(getDashboardOverviewDataMock).toHaveBeenCalledTimes(
        tab === "overview" ? 1 : 0,
      );
    },
  );

  it("leaves non-todo tabs on the nav count fallback", async () => {
    getDashboardNavStatsMock.mockResolvedValue({ pendingTodosCount: 4 });

    await loadTab("links");

    expect(getTodosTabDataMock).not.toHaveBeenCalled();
    expect(getDashboardNavStatsMock).toHaveBeenCalledWith(
      context.user,
      context.subscribedSections,
      undefined,
      undefined,
      expect.any(Array),
      expect.objectContaining({
        complete: true,
        dbContext: "rls",
        dbLabel: "app",
      }),
    );
  });

  it("shares one semester snapshot while todo and nav reads stay independent", async () => {
    getTodosTabDataMock.mockResolvedValue([{ completed: false }]);
    getDashboardNavStatsMock.mockResolvedValue({ pendingTodosCount: 1 });

    await loadTab("overview");

    expect(withUserDbContextMock).not.toHaveBeenCalled();
    expect(getDashboardSemestersMock).toHaveBeenCalledOnce();
    const semesters = await getDashboardSemestersMock.mock.results[0]?.value;
    expect(getDashboardNavStatsMock).toHaveBeenCalledWith(
      context.user,
      context.subscribedSections,
      undefined,
      expect.any(Promise),
      semesters,
      expect.objectContaining({
        complete: true,
        dbContext: "rls",
        dbLabel: "app",
      }),
    );
    expect(getDashboardOverviewDataMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        calendarMode: "preview",
        calendarTodos: expect.any(Array),
        semesters,
      }),
    );
  });

  it("starts overview work without waiting for navigation counts", async () => {
    let releaseNav!: () => void;
    const navGate = new Promise<void>((resolve) => {
      releaseNav = resolve;
    });
    getTodosTabDataMock.mockResolvedValue([]);
    getDashboardNavStatsMock.mockImplementation(async () => {
      await navGate;
      return { pendingTodosCount: 0 };
    });
    getDashboardOverviewDataMock.mockResolvedValue({ calendarMode: "preview" });

    const pending = loadTab("overview");

    await vi.waitFor(() => {
      expect(getDashboardNavStatsMock).toHaveBeenCalledOnce();
      expect(getDashboardOverviewDataMock).toHaveBeenCalledOnce();
    });

    releaseNav();
    await pending;
  });

  it("keeps the calendar tab on the complete semester model", async () => {
    getDashboardNavStatsMock.mockResolvedValue({ pendingTodosCount: 0 });

    await loadTab("calendar");

    expect(getDashboardOverviewDataMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ calendarMode: "semester", skipLinks: true }),
    );
  });
});
