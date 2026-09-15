import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

const {
  countIncompleteTodosMock,
  getWorkspaceNavigationAggregateMock,
  withUserDbContextMock,
  writeWorkspaceStageAnalyticsMock,
} = vi.hoisted(() => ({
  countIncompleteTodosMock: vi.fn(),
  getWorkspaceNavigationAggregateMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
  writeWorkspaceStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  countIncompleteTodos: countIncompleteTodosMock,
}));

vi.mock("@/features/workspace/server/workspace-navigation-summary", () => ({
  getWorkspaceNavigationAggregate: getWorkspaceNavigationAggregateMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeWorkspaceStageAnalytics: writeWorkspaceStageAnalyticsMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

describe("仪表盘导航统计", () => {
  afterEach(() => {
    countIncompleteTodosMock.mockReset();
    getWorkspaceNavigationAggregateMock.mockReset();
    withUserDbContextMock.mockReset();
    writeWorkspaceStageAnalyticsMock.mockReset();
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

    const { getWorkspaceNavStats } = await import(
      "@/features/workspace/server/workspace-nav-stats"
    );

    const result = await getWorkspaceNavStats(
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

    const { getWorkspaceNavStats } = await import(
      "@/features/workspace/server/workspace-nav-stats"
    );

    const resultPromise = getWorkspaceNavStats(
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

    const { getWorkspaceNavStats } = await import(
      "@/features/workspace/server/workspace-nav-stats"
    );
    const { countWorkspaceStageQuery, createWorkspaceStageCounter } =
      await import("@/features/workspace/server/workspace-stage-analytics");
    getWorkspaceNavigationAggregateMock.mockImplementation(
      async (
        _tx: object,
        _userId: string,
        _referenceDate: Date,
        options: {
          stageCounter?: Parameters<typeof countWorkspaceStageQuery>[0];
        },
      ) => {
        countWorkspaceStageQuery(options.stageCounter);
        return aggregate;
      },
    );

    const counter = createWorkspaceStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });
    const resultPromise = getWorkspaceNavStats(
      { id: "user-1", name: "User", username: "user" },
      [{ id: 12, semesterId: 1 }],
      new Date("2026-05-22T10:30:00.000Z"),
      pendingTodos.promise,
      undefined,
      counter,
    );

    await vi.waitFor(() => {
      expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledOnce();
    });
    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledWith(
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

  it("emits one nav datapoint when the page stage wraps the aggregate", async () => {
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

    const { getWorkspaceNavStats } = await import(
      "@/features/workspace/server/workspace-nav-stats"
    );
    const { timeWorkspaceStage } = await import(
      "@/features/workspace/server/workspace-page-tab-data"
    );
    const { createWorkspaceStageCounter } = await import(
      "@/features/workspace/server/workspace-stage-analytics"
    );
    const counter = createWorkspaceStageCounter({
      dbContext: "rls",
      dbLabel: "app",
    });

    await timeWorkspaceStage(
      "nav_stats",
      {
        requestId: "workspace-nav-stage-test",
        subscribedSectionCount: 1,
        tab: "overview",
      },
      () =>
        getWorkspaceNavStats(
          { id: "user-1", name: "User", username: "user" },
          [{ id: 12, semesterId: 1 }],
          new Date("2026-05-22T10:30:00.000Z"),
          undefined,
          undefined,
          counter,
        ),
      counter,
    );

    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledOnce();
    expect(writeWorkspaceStageAnalyticsMock).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "nav_stats" }),
    );
  });
});
