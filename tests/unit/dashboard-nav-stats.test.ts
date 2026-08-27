import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const {
  countIncompleteTodosMock,
  getWorkspaceNavigationAggregateMock,
  withUserDbContextMock,
  writeDashboardStageAnalyticsMock,
} = vi.hoisted(() => ({
  countIncompleteTodosMock: vi.fn(),
  getWorkspaceNavigationAggregateMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
  writeDashboardStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  countIncompleteTodos: countIncompleteTodosMock,
}));

vi.mock("@/features/dashboard/server/workspace-navigation-summary", () => ({
  getWorkspaceNavigationAggregate: getWorkspaceNavigationAggregateMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeDashboardStageAnalytics: writeDashboardStageAnalyticsMock,
}));

describe("仪表盘导航统计", () => {
  afterEach(() => {
    countIncompleteTodosMock.mockReset();
    getWorkspaceNavigationAggregateMock.mockReset();
    withUserDbContextMock.mockReset();
    writeDashboardStageAnalyticsMock.mockReset();
    vi.resetModules();
  });

  it("uses the shared aggregate read model for all navigation counts", async () => {
    const referenceNow = new Date("2026-05-22T10:30:00.000Z");
    getWorkspaceNavigationAggregateMock.mockResolvedValue({
      calendarItemsCount: 9,
      examsCount: 3,
      highlightPendingHomeworks: true,
      pendingHomeworksCount: 2,
      pendingTodosCount: 4,
      subscribedSectionCount: 2,
    });
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: object) => unknown) => action({}),
    );

    const { getDashboardNavStats } = await import(
      "@/features/dashboard/server/dashboard-nav-stats"
    );

    const result = await getDashboardNavStats(
      { id: "user-1", name: "User", username: "user" },
      [
        { id: 12, semesterId: 1 },
        { id: 34, semesterId: 1 },
      ],
      referenceNow,
    );

    expect(getWorkspaceNavigationAggregateMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      referenceNow,
      {
        activeSections: [
          { id: 12, semesterId: 1 },
          { id: 34, semesterId: 1 },
        ],
        skipPendingTodosCount: false,
        semesters: undefined,
      },
    );
    expect(countIncompleteTodosMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      calendarItemsCount: 9,
      examsCount: 3,
      highlightPendingHomeworks: true,
      pendingHomeworksCount: 2,
      pendingTodosCount: 4,
    });
  });

  it("reuses the already loaded todo count while aggregate work runs", async () => {
    const pendingTodos = createDeferred<number>();
    getWorkspaceNavigationAggregateMock.mockResolvedValue({
      calendarItemsCount: 9,
      examsCount: 3,
      highlightPendingHomeworks: false,
      pendingHomeworksCount: 2,
      pendingTodosCount: 4,
      subscribedSectionCount: 1,
    });
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: object) => unknown) => action({}),
    );

    const { getDashboardNavStats } = await import(
      "@/features/dashboard/server/dashboard-nav-stats"
    );

    const resultPromise = getDashboardNavStats(
      { id: "user-1", name: "User", username: "user" },
      [{ id: 12, semesterId: 1 }],
      new Date("2026-05-22T10:30:00.000Z"),
      pendingTodos.promise,
    );

    expect(getWorkspaceNavigationAggregateMock).toHaveBeenCalledOnce();
    expect(getWorkspaceNavigationAggregateMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      expect.any(Date),
      expect.objectContaining({ skipPendingTodosCount: true }),
    );
    expect(countIncompleteTodosMock).not.toHaveBeenCalled();

    pendingTodos.resolve(5);
    await expect(resultPromise).resolves.toMatchObject({
      pendingTodosCount: 5,
    });
  });

  it("records nav telemetry when the aggregate finishes without waiting for todos", async () => {
    const pendingTodos = createDeferred<number>();
    const aggregate = {
      calendarItemsCount: 9,
      examsCount: 3,
      highlightPendingHomeworks: false,
      pendingHomeworksCount: 2,
      pendingTodosCount: 4,
      subscribedSectionCount: 1,
    };
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: object) => unknown) => action({}),
    );

    const { getDashboardNavStats } = await import(
      "@/features/dashboard/server/dashboard-nav-stats"
    );
    const { countDashboardStageQuery, createDashboardStageCounter } =
      await import("@/features/dashboard/server/dashboard-stage-analytics");
    getWorkspaceNavigationAggregateMock.mockImplementation(
      async (
        _tx: object,
        _userId: string,
        _referenceDate: Date,
        options: {
          stageCounter?: Parameters<typeof countDashboardStageQuery>[0];
        },
      ) => {
        countDashboardStageQuery(options.stageCounter);
        return aggregate;
      },
    );

    const counter = createDashboardStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    const resultPromise = getDashboardNavStats(
      { id: "user-1", name: "User", username: "user" },
      [{ id: 12, semesterId: 1 }],
      new Date("2026-05-22T10:30:00.000Z"),
      pendingTodos.promise,
      undefined,
      counter,
    );

    await vi.waitFor(() => {
      expect(writeDashboardStageAnalyticsMock).toHaveBeenCalledOnce();
    });
    expect(writeDashboardStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dbContext: "rls",
        dbQueryCount: 1,
        dbTransactionCount: 1,
        stage: "nav_stats",
        subscribedSectionCount: 1,
      }),
    );

    pendingTodos.resolve(5);
    await expect(resultPromise).resolves.toMatchObject({
      pendingTodosCount: 5,
    });
  });
});
