import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  analyticsMock,
  countUpcomingSubscribedExamsMock,
  homeworkCountMock,
  listSubscribedHomeworksMock,
  listSubscribedSchedulesMock,
  loadOverviewTodoBundleMock,
  listUpcomingSubscribedExamsMock,
  runCloudflareTraceSpanMock,
  scheduleCountMock,
  userFindUniqueMock,
  withHomeworkItemStateMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  analyticsMock: vi.fn(),
  countUpcomingSubscribedExamsMock: vi.fn(),
  homeworkCountMock: vi.fn(),
  listSubscribedHomeworksMock: vi.fn(),
  listSubscribedSchedulesMock: vi.fn(),
  loadOverviewTodoBundleMock: vi.fn(),
  listUpcomingSubscribedExamsMock: vi.fn(),
  runCloudflareTraceSpanMock: vi.fn(),
  scheduleCountMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  withHomeworkItemStateMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  runCloudflareTraceSpan: runCloudflareTraceSpanMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    schedule: { count: scheduleCountMock },
    user: { findUnique: userFindUniqueMock },
  },
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeWorkspaceOverviewStageAnalytics: analyticsMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", () => ({
  withHomeworkItemState: withHomeworkItemStateMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  countUpcomingSubscribedExams: countUpcomingSubscribedExamsMock,
  listSubscribedHomeworks: listSubscribedHomeworksMock,
  listSubscribedSchedules: listSubscribedSchedulesMock,
  listUpcomingSubscribedExams: listUpcomingSubscribedExamsMock,
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  loadOverviewTodoBundle: loadOverviewTodoBundleMock,
}));

const AT_TIME = new Date("2026-07-29T08:00:00.000Z");
const TODO_COUNTS = { completed: 2, incomplete: 3, overdue: 1 };
const TODO_BUNDLE = {
  todos: {
    counts: TODO_COUNTS,
    todos: [{ id: "todo-1" }],
  },
  dueTodosCount: 2,
  dueTodos: [{ id: "due-todo-1" }],
};

describe("compact workspace overview read model", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
    withUserDbContextMock.mockImplementation((_userId, action) =>
      action({
        homework: { count: homeworkCountMock },
        user: { findUnique: userFindUniqueMock },
      }),
    );
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      image: "avatar.png",
      isAdmin: true,
      name: "User One",
      sectionSubscriptions: [{ sectionId: 11 }],
    });
    loadOverviewTodoBundleMock.mockImplementation(
      async ({ runTodoSummary, runDueTodoCount, runDueTodoSample }) => ({
        todos: await runTodoSummary?.(() => Promise.resolve(TODO_BUNDLE.todos)),
        dueTodosCount: await runDueTodoCount?.(() =>
          Promise.resolve(TODO_BUNDLE.dueTodosCount),
        ),
        dueTodos: await runDueTodoSample?.(() =>
          Promise.resolve(TODO_BUNDLE.dueTodos),
        ),
      }),
    );
    homeworkCountMock.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    scheduleCountMock.mockResolvedValue(1);
    countUpcomingSubscribedExamsMock.mockResolvedValue(3);
    listSubscribedSchedulesMock.mockResolvedValue([]);
    listSubscribedHomeworksMock.mockResolvedValue([]);
    listUpcomingSubscribedExamsMock.mockResolvedValue([]);
    withHomeworkItemStateMock.mockImplementation(async (items) => items);
  });

  it("reads user fields and active sections once with fixed overview stages", async () => {
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );

    const overview = await getCompactOverview("user-1", { atTime: AT_TIME });

    expect(userFindUniqueMock).toHaveBeenCalledOnce();
    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        image: true,
        isAdmin: true,
        name: true,
        sectionSubscriptions: {
          where: { section: { retiredAt: null } },
          select: { sectionId: true },
        },
      },
    });
    expect(loadOverviewTodoBundleMock).toHaveBeenCalledOnce();
    expect(loadOverviewTodoBundleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        now: AT_TIME,
        limit: 3,
        runTodoSummary: expect.any(Function),
        runDueTodoCount: expect.any(Function),
        runDueTodoSample: expect.any(Function),
      }),
    );
    expect(countUpcomingSubscribedExamsMock).toHaveBeenCalledWith({
      atTime: AT_TIME,
      sectionIds: [11],
    });
    expect(listSubscribedSchedulesMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11] }),
    );
    expect(overview.user).toEqual({
      image: "avatar.png",
      isAdmin: true,
      name: "User One",
      userId: "user-1",
    });
    expect(overview.counts).toEqual({
      dueSoonHomeworks: 2,
      pendingHomeworks: 4,
      todaySchedules: 1,
      todos: TODO_COUNTS,
      upcomingExams: 3,
    });
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["workspace.overview.user_sections", {}],
      ["workspace.overview.todo_summary", {}],
      ["workspace.overview.due_todo_count", {}],
      ["workspace.overview.due_todo_sample", {}],
      ["workspace.overview.counts", {}],
      ["workspace.overview.lists", {}],
      ["workspace.overview.item_state", {}],
    ]);
    expect(
      analyticsMock.mock.calls.map(([input]) => [input.stage, input.status]),
    ).toEqual([
      ["user_sections", "success"],
      ["todo_summary", "success"],
      ["due_todo_count", "success"],
      ["due_todo_sample", "success"],
      ["counts", "success"],
      ["lists", "success"],
      ["item_state", "success"],
    ]);
  });

  it("loads todo reads in one bundle while running the three sub-stages in parallel", async () => {
    let resolveSummary:
      | ((value: {
          counts: typeof TODO_COUNTS;
          todos: { id: string }[];
        }) => void)
      | undefined;
    loadOverviewTodoBundleMock.mockImplementation(
      async ({ runTodoSummary, runDueTodoCount, runDueTodoSample }) => ({
        todos: await runTodoSummary?.(
          () =>
            new Promise((resolve) => {
              resolveSummary = resolve;
            }),
        ),
        dueTodosCount: await runDueTodoCount?.(() => Promise.resolve(2)),
        dueTodos: await runDueTodoSample?.(() =>
          Promise.resolve([{ id: "due-todo-1" }]),
        ),
      }),
    );
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );

    const overviewPromise = getCompactOverview("user-1", { atTime: AT_TIME });

    expect(loadOverviewTodoBundleMock).toHaveBeenCalledOnce();
    resolveSummary?.({ counts: TODO_COUNTS, todos: [{ id: "todo-1" }] });
    await overviewPromise;
  });

  it.each([
    {
      label: "only retired sections remain after the active-section filter",
      user: {
        id: "user-1",
        image: null,
        isAdmin: false,
        name: "User One",
        sectionSubscriptions: [],
      },
      expectedUser: {
        image: null,
        isAdmin: false,
        name: "User One",
        userId: "user-1",
      },
    },
    {
      label: "the user row is missing",
      user: null,
      expectedUser: {
        image: null,
        isAdmin: false,
        name: null,
        userId: "user-1",
      },
    },
  ])("uses empty section semantics when $label", async ({
    user,
    expectedUser,
  }) => {
    userFindUniqueMock.mockResolvedValue(user);
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );

    const overview = await getCompactOverview("user-1", { atTime: AT_TIME });

    expect(userFindUniqueMock).toHaveBeenCalledOnce();
    expect(homeworkCountMock).not.toHaveBeenCalled();
    expect(scheduleCountMock).not.toHaveBeenCalled();
    expect(countUpcomingSubscribedExamsMock).not.toHaveBeenCalled();
    expect(listSubscribedSchedulesMock).not.toHaveBeenCalled();
    expect(listSubscribedHomeworksMock).not.toHaveBeenCalled();
    expect(listUpcomingSubscribedExamsMock).not.toHaveBeenCalled();
    expect(withHomeworkItemStateMock).toHaveBeenCalledWith([], "user-1");
    expect(overview.user).toEqual(expectedUser);
    expect(overview.counts).toEqual({
      dueSoonHomeworks: 0,
      pendingHomeworks: 0,
      todaySchedules: 0,
      todos: TODO_COUNTS,
      upcomingExams: 0,
    });
  });

  it("starts count and list groups together while preserving each group fan-out", async () => {
    let resolveFirstCount: ((value: number) => void) | undefined;
    homeworkCountMock.mockReset();
    homeworkCountMock
      .mockReturnValueOnce(
        new Promise<number>((resolve) => {
          resolveFirstCount = resolve;
        }),
      )
      .mockResolvedValueOnce(2);
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );

    const overviewPromise = getCompactOverview("user-1", { atTime: AT_TIME });

    await vi.waitFor(() => {
      expect(homeworkCountMock).toHaveBeenCalledTimes(2);
      expect(scheduleCountMock).toHaveBeenCalledOnce();
      expect(countUpcomingSubscribedExamsMock).toHaveBeenCalledOnce();
      expect(listSubscribedSchedulesMock).toHaveBeenCalledOnce();
      expect(listSubscribedHomeworksMock).toHaveBeenCalledOnce();
      expect(listUpcomingSubscribedExamsMock).toHaveBeenCalledOnce();
    });
    resolveFirstCount?.(4);
    await overviewPromise;
  });

  it("records an error status and rethrows a failed overview stage", async () => {
    withHomeworkItemStateMock.mockRejectedValue(new Error("item state failed"));
    const { getCompactOverview } = await import(
      "@/features/dashboard/server/compact-overview-read-model"
    );

    await expect(
      getCompactOverview("user-1", { atTime: AT_TIME }),
    ).rejects.toThrow("item state failed");
    expect(analyticsMock).toHaveBeenCalledWith({
      ioObservedDurationMs: expect.any(Number),
      stage: "item_state",
      status: "error",
    });
  });
});
