import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEV_SEED_ANCHOR } from "../../../fixtures/dev-seed";
import { createDeferred } from "../../../shared/deferred";

const {
  analyticsMock,
  loadOverviewSubscriptionReadsMock,
  loadOverviewTodoBundleMock,
  runCloudflareTraceSpanMock,
  userFindUniqueMock,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const tx = { user: { findUnique: userFindUnique } };
  return {
    analyticsMock: vi.fn(),
    loadOverviewSubscriptionReadsMock: vi.fn(),
    loadOverviewTodoBundleMock: vi.fn(),
    runCloudflareTraceSpanMock: vi.fn(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    ),
    userFindUniqueMock: userFindUnique,
    withUserDbContextMock: vi.fn(
      async (
        _userId: string,
        action: (client: typeof tx) => Promise<unknown>,
      ) => action(tx),
    ),
  };
});

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  runCloudflareTraceSpan: runCloudflareTraceSpanMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeWorkspaceOverviewStageAnalytics: analyticsMock,
}));

vi.mock(
  "@/features/workspace/server/compact-overview-subscription-bundle",
  () => ({
    loadOverviewSubscriptionReads: loadOverviewSubscriptionReadsMock,
  }),
);

vi.mock("@/features/todos/server/todo-service", () => ({
  loadOverviewTodoBundle: loadOverviewTodoBundleMock,
}));

const AT_TIME = new Date(DEV_SEED_ANCHOR.recommendedAtTime);
const TODO_COUNTS = { completed: 2, incomplete: 3, overdue: 1 };
const TODO_BUNDLE = {
  todos: {
    counts: TODO_COUNTS,
    todos: [{ id: "todo-1" }],
  },
  dueTodosCount: 2,
  dueTodos: [{ id: "due-todo-1" }],
};
const SUBSCRIPTION_READS = {
  counts: {
    pendingHomeworksCount: 4,
    todaySchedulesCount: 1,
    upcomingExamsCount: 3,
    dueSoonHomeworksCount: 2,
  },
  dueSoonHomeworks: [],
  schedules: [],
  upcomingExams: [],
};

describe("compact workspace overview read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
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
    loadOverviewSubscriptionReadsMock.mockResolvedValue(SUBSCRIPTION_READS);
  });

  it("reads user fields and active sections once with fixed overview stages", async () => {
    const { getCompactOverview } = await import(
      "@/features/workspace/server/compact-overview-read-model"
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
        includeSamples: true,
        limit: 3,
        runTodoSummary: expect.any(Function),
        runDueTodoCount: expect.any(Function),
        runDueTodoSample: expect.any(Function),
      }),
    );
    expect(loadOverviewSubscriptionReadsMock).toHaveBeenCalledOnce();
    expect(loadOverviewSubscriptionReadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        atTime: AT_TIME,
        includeSamples: true,
        limit: 3,
        locale: "zh-cn",
        sectionIds: [11],
        runStage: expect.any(Function),
      }),
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
    ).toEqual(
      expect.arrayContaining([
        ["workspace.overview.user_sections", {}],
        ["workspace.overview.todo_summary", {}],
        ["workspace.overview.due_todo_count", {}],
        ["workspace.overview.due_todo_sample", {}],
      ]),
    );
    expect(
      analyticsMock.mock.calls.map(([input]) => [input.stage, input.status]),
    ).toEqual(
      expect.arrayContaining([
        ["user_sections", "success"],
        ["todo_summary", "success"],
        ["due_todo_count", "success"],
        ["due_todo_sample", "success"],
      ]),
    );
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
  ])(
    "passes derived sectionIds to the subscription bundle when $label",
    async ({ user, expectedUser }) => {
      userFindUniqueMock.mockResolvedValue(user);
      loadOverviewSubscriptionReadsMock.mockResolvedValue({
        counts: {
          pendingHomeworksCount: 0,
          todaySchedulesCount: 0,
          upcomingExamsCount: 0,
          dueSoonHomeworksCount: 0,
        },
        dueSoonHomeworks: [],
        schedules: [],
        upcomingExams: [],
      });
      const { getCompactOverview } = await import(
        "@/features/workspace/server/compact-overview-read-model"
      );

      const overview = await getCompactOverview("user-1", { atTime: AT_TIME });

      expect(loadOverviewSubscriptionReadsMock).toHaveBeenCalledWith(
        expect.objectContaining({ sectionIds: [] }),
      );
      expect(overview.user).toEqual(expectedUser);
      expect(overview.counts).toEqual({
        dueSoonHomeworks: 0,
        pendingHomeworks: 0,
        todaySchedules: 0,
        todos: TODO_COUNTS,
        upcomingExams: 0,
      });
    },
  );

  it("overlaps todo loading with subscription bundle reads", async () => {
    const { promise: todoSummaryPromise, resolve: resolveTodoSummary } =
      createDeferred<{
        counts: typeof TODO_COUNTS;
        todos: Array<{ id: string }>;
      }>();
    const {
      promise: subscriptionReadsPromise,
      resolve: resolveSubscriptionReads,
    } = createDeferred<typeof SUBSCRIPTION_READS>();
    loadOverviewTodoBundleMock.mockImplementation(
      async ({ runTodoSummary, runDueTodoCount, runDueTodoSample }) => ({
        todos: await runTodoSummary?.(() => todoSummaryPromise),
        dueTodosCount: await runDueTodoCount?.(() => Promise.resolve(2)),
        dueTodos: await runDueTodoSample?.(() =>
          Promise.resolve([{ id: "due-todo-1" }]),
        ),
      }),
    );
    loadOverviewSubscriptionReadsMock.mockReturnValue(subscriptionReadsPromise);
    const { getCompactOverview } = await import(
      "@/features/workspace/server/compact-overview-read-model"
    );

    const overviewPromise = getCompactOverview("user-1", { atTime: AT_TIME });

    await vi.waitFor(() => {
      expect(loadOverviewSubscriptionReadsMock).toHaveBeenCalled();
    });
    resolveTodoSummary({ counts: TODO_COUNTS, todos: [{ id: "todo-1" }] });
    resolveSubscriptionReads(SUBSCRIPTION_READS);
    await overviewPromise;
  });

  it("records an error status and rethrows a failed user_sections stage", async () => {
    userFindUniqueMock.mockRejectedValue(new Error("user lookup failed"));
    const { getCompactOverview } = await import(
      "@/features/workspace/server/compact-overview-read-model"
    );

    await expect(
      getCompactOverview("user-1", { atTime: AT_TIME }),
    ).rejects.toThrow("user lookup failed");
    expect(analyticsMock).toHaveBeenCalledWith({
      ioObservedDurationMs: expect.any(Number),
      stage: "user_sections",
      status: "error",
    });
  });
});
