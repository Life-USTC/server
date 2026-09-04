import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

type ReadShape = {
  name: string;
  sectionCount: number;
  todoCount: number;
};

type ReadRecord = {
  queryCount: number;
  rowCount: number;
  stage: "nav_stats" | "todos";
  transactionId: number;
  userId: string;
};

const READ_SHAPES: ReadShape[] = [
  { name: "small", sectionCount: 2, todoCount: 3 },
  { name: "large", sectionCount: 64, todoCount: 160 },
];

const {
  getDashboardNavStatsMock,
  getDashboardOverviewDataMock,
  getDashboardSemestersMock,
  getTodosTabDataMock,
  transactionState,
  withUserDbContextMock,
} = vi.hoisted(() => {
  let activeTransaction: { id: number } | undefined;
  let nextTransactionId = 0;
  const state = {
    active: 0,
    maxActive: 0,
    reads: [] as ReadRecord[],
  };
  const withUserDbContext = vi.fn(
    async (
      _userId: string,
      action: (tx: { id: number }) => Promise<unknown>,
    ) => {
      const inheritedTransaction = activeTransaction;
      if (inheritedTransaction) return action(inheritedTransaction);

      const transaction = { id: ++nextTransactionId };
      activeTransaction = transaction;
      state.active += 1;
      state.maxActive = Math.max(state.maxActive, state.active);

      let result: Promise<unknown>;
      try {
        result = action(transaction);
      } catch (error) {
        activeTransaction = inheritedTransaction;
        state.active -= 1;
        throw error;
      }
      activeTransaction = inheritedTransaction;
      return result.finally(() => {
        state.active -= 1;
      });
    },
  );

  return {
    getDashboardNavStatsMock: vi.fn(),
    getDashboardOverviewDataMock: vi.fn(),
    getDashboardSemestersMock: vi.fn(),
    getTodosTabDataMock: vi.fn(),
    transactionState: state,
    withUserDbContextMock: withUserDbContext,
  };
});

vi.mock("@/features/workspace/server/dashboard-overview-data", () => ({
  getDashboardNavStats: getDashboardNavStatsMock,
  getDashboardOverviewData: getDashboardOverviewDataMock,
  getDashboardSemesters: getDashboardSemestersMock,
}));

vi.mock("@/features/workspace/server/dashboard-tab-data", () => ({
  getBusTabData: vi.fn(),
  getCalendarSubscriptionUrl: vi.fn(),
  getHomeworksTabData: vi.fn(),
  getSubscriptionsTabData: vi.fn(),
  getTodosTabData: getTodosTabDataMock,
}));

vi.mock("@/features/catalog-links/server/catalog-link-data", () => ({
  getLinksTabData: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));

import { loadSignedDashboardTabData } from "@/features/workspace/server/dashboard-page-tab-data";

function buildContext(sectionCount: number) {
  const subscribedSections = Array.from(
    { length: sectionCount },
    (_, index) => ({ id: index + 1, semesterId: 1, retiredAt: null }),
  );
  return {
    sectionIds: subscribedSections.map((section) => section.id),
    subscribedSections,
    user: {
      calendarFeedToken: null,
      id: "user-1",
      name: "User",
      username: "user",
    },
  };
}

function loadOverviewTab(sectionCount: number) {
  return loadSignedDashboardTabData({
    calendarSemesterId: undefined,
    context: buildContext(sectionCount),
    locale: "en-us",
    referenceNow: new Date("2026-05-22T10:30:00.000Z"),
    requestId: "dashboard-parallelism-test",
    tab: "overview",
    userId: "user-1",
  });
}

describe("signed dashboard RLS fan-out benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionState.active = 0;
    transactionState.maxActive = 0;
    transactionState.reads = [];
    getDashboardSemestersMock.mockResolvedValue([
      {
        id: 1,
        nameCn: "2026春",
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    getDashboardOverviewDataMock.mockResolvedValue({});
  });

  it.each(READ_SHAPES)(
    "keeps fixed user reads independent for the $name subscription/todo shape",
    async ({ sectionCount, todoCount }) => {
      const todoGate = createDeferred<void>();
      const navGate = createDeferred<void>();
      const todos = Array.from({ length: todoCount }, (_, index) => ({
        completed: index % 4 === 0,
        content: null,
        createdAt: "2026-05-22T02:30:00.000Z",
        dueAt: null,
        id: `todo-${index}`,
        priority: "medium" as const,
        title: `Todo ${index}`,
        updatedAt: "2026-05-22T02:30:00.000Z",
      }));

      getTodosTabDataMock.mockImplementation(() =>
        withUserDbContextMock("user-1", async (tx) => {
          transactionState.reads.push({
            queryCount: 1,
            rowCount: todos.length,
            stage: "todos",
            transactionId: tx.id,
            userId: "user-1",
          });
          await todoGate.promise;
          return todos;
        }),
      );
      getDashboardNavStatsMock.mockImplementation(
        async (
          _user: unknown,
          _sections: unknown,
          _referenceNow: unknown,
          pendingTodosCount: Promise<number> | undefined,
        ) =>
          withUserDbContextMock("user-1", async (tx) => {
            transactionState.reads.push({
              queryCount: 1,
              rowCount: sectionCount,
              stage: "nav_stats",
              transactionId: tx.id,
              userId: "user-1",
            });
            await navGate.promise;
            return {
              pendingTodosCount: (await pendingTodosCount) ?? 0,
            };
          }),
      );

      const resultPromise = loadOverviewTab(sectionCount);
      await vi.waitFor(() => {
        expect(transactionState.reads).toHaveLength(2);
      });

      // A shared interactive transaction would make both reads observe one
      // client and this maximum stay at one. Separate user contexts overlap
      // at the pool boundary while preserving the explicit user ID.
      expect(transactionState.maxActive).toBe(2);
      expect(
        new Set(transactionState.reads.map((read) => read.transactionId)).size,
      ).toBe(2);
      expect(transactionState.reads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            queryCount: 1,
            rowCount: todoCount,
            stage: "todos",
            userId: "user-1",
          }),
          expect.objectContaining({
            queryCount: 1,
            rowCount: sectionCount,
            stage: "nav_stats",
            userId: "user-1",
          }),
        ]),
      );

      todoGate.resolve();
      navGate.resolve();
      const result = await resultPromise;
      expect(result.todos).toHaveLength(todoCount);
      expect(result.navStats).toEqual({
        pendingTodosCount: todos.filter((todo) => !todo.completed).length,
      });
      expect(getTodosTabDataMock).toHaveBeenCalledOnce();
      expect(getDashboardNavStatsMock).toHaveBeenCalledOnce();
      expect(withUserDbContextMock).toHaveBeenCalledTimes(2);
      expect(transactionState.active).toBe(0);
    },
  );
});
