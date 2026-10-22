import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceOverviewStage } from "@/lib/metrics/analytics-engine";
import { DEV_SEED_ANCHOR } from "../../../fixtures/dev-seed";
import { createDeferred } from "../../../shared/deferred";

const AT_TIME = new Date(DEV_SEED_ANCHOR.recommendedAtTime);
const TODAY_START = new Date(DEV_SEED_ANCHOR.startOfDayAtTime);
const TOMORROW_START = new Date(TODAY_START.getTime() + 24 * 60 * 60 * 1000);
const HOMEWORK_WINDOW_END = new Date("2026-05-06T08:00:00+08:00");

const {
  commentGroupByMock,
  fetchSubscribedHomeworkRlsSnapshotMock,
  homeworkCountMock,
  listTodaySubscribedSchedulesWithCountMock,
  listUpcomingSubscribedExamsWithCountMock,
  localizeSubscribedHomeworkWorkspaceItemsMock,
  subscriptionFindManyMock,
  transactionMock,
  withHomeworkItemStateMock,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const commentGroupBy = vi.fn();
  const homeworkCount = vi.fn();
  const subscriptionFindMany = vi.fn();
  const tx = {
    $queryRaw: vi.fn(async () => []),
    comment: { groupBy: commentGroupBy },
    homework: { count: homeworkCount },
    userSectionSubscription: { findMany: subscriptionFindMany },
  };
  // Every `withUserDbContext` is a real interactive transaction, so a nested
  // viewer read only stays free while it reuses the one already open. Driving
  // the production RLS context over a counting starter makes that visible.
  const transaction = vi.fn(
    async (action: (client: typeof tx) => Promise<unknown>) => action(tx),
  );
  return {
    commentGroupByMock: commentGroupBy,
    fetchSubscribedHomeworkRlsSnapshotMock: vi.fn(),
    homeworkCountMock: homeworkCount,
    listTodaySubscribedSchedulesWithCountMock: vi.fn(),
    listUpcomingSubscribedExamsWithCountMock: vi.fn(),
    localizeSubscribedHomeworkWorkspaceItemsMock: vi.fn(),
    subscriptionFindManyMock: subscriptionFindMany,
    transactionMock: transaction,
    withHomeworkItemStateMock: vi.fn(async (items: unknown[]) => items),
    withUserDbContextMock: vi.fn(
      async (userId: string, action: (client: typeof tx) => Promise<unknown>) =>
        (await import("@/lib/db/rls-context")).runWithUserRlsContext(
          { $transaction: transaction } as unknown as Parameters<
            typeof import("@/lib/db/rls-context").runWithUserRlsContext
          >[0],
          userId,
          action as never,
        ),
    ),
  };
});

// `vi.fn` cannot carry a generic call signature, so spy on the stage call and
// run the work through a wrapper that keeps `runStage`'s `<T>` inference.
const runStageMock =
  vi.fn<
    (stage: WorkspaceOverviewStage, work: () => Promise<unknown>) => void
  >();
const runStage = <T>(stage: WorkspaceOverviewStage, work: () => Promise<T>) => {
  runStageMock(stage, work);
  return work();
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", async () => ({
  ...(await vi.importActual<
    typeof import("@/features/homeworks/server/homework-item-state")
  >("@/features/homeworks/server/homework-item-state")),
  withHomeworkItemState: withHomeworkItemStateMock,
}));

vi.mock("@/features/subscriptions/server/subscription-homework-list", () => ({
  fetchSubscribedHomeworkRlsSnapshot: fetchSubscribedHomeworkRlsSnapshotMock,
  localizeSubscribedHomeworkWorkspaceItems:
    localizeSubscribedHomeworkWorkspaceItemsMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listTodaySubscribedSchedulesWithCount:
    listTodaySubscribedSchedulesWithCountMock,
  listUpcomingSubscribedExamsWithCount:
    listUpcomingSubscribedExamsWithCountMock,
}));

const loadReads = async (
  sectionIds: readonly number[],
  options: { includeSamples?: boolean } = {},
) => {
  const { loadOverviewSubscriptionReads } = await import(
    "@/features/workspace/server/compact-overview-subscription-bundle"
  );
  return loadOverviewSubscriptionReads({
    atTime: AT_TIME,
    homeworkWindowEnd: HOMEWORK_WINDOW_END,
    includeSamples: options.includeSamples,
    limit: 3,
    locale: "zh-cn",
    runStage,
    sectionIds,
    todayStart: TODAY_START,
    tomorrowStart: TOMORROW_START,
    userId: "user-1",
  });
};

describe("compact overview subscription bundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commentGroupByMock.mockResolvedValue([
      { homeworkId: "homework-1", _count: { _all: 7 } },
    ]);
    subscriptionFindManyMock.mockResolvedValue([
      { sectionId: 11, kind: "teaching_assistant" },
    ]);
    homeworkCountMock.mockResolvedValue(4);
    fetchSubscribedHomeworkRlsSnapshotMock.mockResolvedValue({
      total: 2,
      homeworkIds: ["homework-1"],
      completions: [],
    });
    localizeSubscribedHomeworkWorkspaceItemsMock.mockResolvedValue([
      { id: "homework-1" },
    ]);
    listTodaySubscribedSchedulesWithCountMock.mockResolvedValue({
      total: 1,
      items: [{ id: "schedule-1" }],
    });
    listUpcomingSubscribedExamsWithCountMock.mockResolvedValue({
      total: 3,
      items: [{ id: "exam-1" }],
    });
    withHomeworkItemStateMock.mockImplementation(async (items) => items);
  });

  it("short-circuits counts and list queries when sectionIds is empty", async () => {
    const result = await loadReads([]);

    expect(homeworkCountMock).not.toHaveBeenCalled();
    expect(fetchSubscribedHomeworkRlsSnapshotMock).not.toHaveBeenCalled();
    expect(listTodaySubscribedSchedulesWithCountMock).not.toHaveBeenCalled();
    expect(listUpcomingSubscribedExamsWithCountMock).not.toHaveBeenCalled();
    expect(withHomeworkItemStateMock).not.toHaveBeenCalled();
    expect(runStageMock).not.toHaveBeenCalledWith(
      "item_state",
      expect.any(Function),
    );
    expect(result.counts).toEqual({
      pendingHomeworksCount: 0,
      todaySchedulesCount: 0,
      upcomingExamsCount: 0,
      dueSoonHomeworksCount: 0,
    });
    expect(result.schedules).toEqual([]);
    expect(result.upcomingExams).toEqual([]);
    expect(result.dueSoonHomeworks).toEqual([]);
  });

  it("loads subscribed overview reads with paired count+list helpers and a single homework fetch", async () => {
    const result = await loadReads([11]);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(fetchSubscribedHomeworkRlsSnapshotMock).toHaveBeenCalledOnce();
    expect(fetchSubscribedHomeworkRlsSnapshotMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [11] },
        }),
      }),
      true,
    );
    expect(localizeSubscribedHomeworkWorkspaceItemsMock).toHaveBeenCalledOnce();
    expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        sectionIds: [11],
        limit: 3,
        includeItems: true,
      }),
    );
    expect(listUpcomingSubscribedExamsWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        sectionIds: [11],
        limit: 3,
        includeItems: true,
      }),
    );
    expect(result.counts).toEqual({
      pendingHomeworksCount: 4,
      todaySchedulesCount: 1,
      upcomingExamsCount: 3,
      dueSoonHomeworksCount: 2,
    });
    expect(result.schedules).toEqual([{ id: "schedule-1" }]);
    expect(result.upcomingExams).toEqual([{ id: "exam-1" }]);
    expect(result.dueSoonHomeworks).toEqual([{ id: "homework-1" }]);
    expect(runStageMock).toHaveBeenCalledWith("counts", expect.any(Function));
    expect(runStageMock).toHaveBeenCalledWith("lists", expect.any(Function));
    expect(runStageMock).toHaveBeenCalledWith(
      "item_state",
      expect.any(Function),
    );
  });

  it("skips sample list queries when includeSamples is false", async () => {
    const result = await loadReads([11], { includeSamples: false });

    expect(withHomeworkItemStateMock).not.toHaveBeenCalled();
    expect(localizeSubscribedHomeworkWorkspaceItemsMock).not.toHaveBeenCalled();
    expect(fetchSubscribedHomeworkRlsSnapshotMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [11] },
        }),
      }),
      false,
    );
    expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], includeItems: false }),
    );
    expect(listUpcomingSubscribedExamsWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], includeItems: false }),
    );
    expect(result.schedules).toEqual([]);
    expect(result.upcomingExams).toEqual([]);
    expect(result.dueSoonHomeworks).toEqual([]);
    expect(result.counts).toEqual({
      pendingHomeworksCount: 4,
      todaySchedulesCount: 1,
      upcomingExamsCount: 3,
      dueSoonHomeworksCount: 2,
    });
  });

  it("runs item_state while counts and schedule list work are still pending", async () => {
    const { promise: homeworkRlsDeferred, resolve: resolveHomeworkRls } =
      createDeferred<{
        pendingHomeworksCount: number;
        dueSoonRls: {
          total: number;
          homeworkIds: string[];
          completions: [];
        };
        viewerState: {
          commentCounts: ReadonlyMap<string, number>;
          subscriptionKinds: ReadonlyMap<number, string>;
        };
      }>();
    withUserDbContextMock.mockImplementationOnce(() => homeworkRlsDeferred);

    const readsPromise = loadReads([11]);

    await vi.waitFor(() => {
      expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalled();
    });
    expect(withHomeworkItemStateMock).not.toHaveBeenCalled();
    resolveHomeworkRls({
      pendingHomeworksCount: 4,
      dueSoonRls: { total: 2, homeworkIds: ["homework-1"], completions: [] },
      viewerState: {
        commentCounts: new Map([["homework-1", 7]]),
        subscriptionKinds: new Map([[11, "teaching_assistant"]]),
      },
    });
    await readsPromise;
    expect(withHomeworkItemStateMock).toHaveBeenCalledWith(
      [{ id: "homework-1" }],
      "user-1",
      new Map([["homework-1", 7]]),
    );
  });

  it("prefetches subscription kinds and comment counts inside the homework transaction", async () => {
    await loadReads([11]);

    // Subscription kinds and comment counts depend only on values the
    // homework transaction already holds, so they belong inside it. Issued
    // from the serial tail instead, each opens its own transaction and pays
    // BEGIN, set_config and COMMIT on top of its one real query.
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(subscriptionFindManyMock).toHaveBeenCalledOnce();
    expect(commentGroupByMock).toHaveBeenCalledOnce();
    expect(localizeSubscribedHomeworkWorkspaceItemsMock).toHaveBeenCalledWith(
      expect.anything(),
      "zh-cn",
      "user-1",
      new Map([[11, "teaching_assistant"]]),
    );
    expect(withHomeworkItemStateMock).toHaveBeenCalledWith(
      [{ id: "homework-1" }],
      "user-1",
      new Map([["homework-1", 7]]),
    );
  });

  it("skips the viewer-state reads when no homework sample is due", async () => {
    fetchSubscribedHomeworkRlsSnapshotMock.mockResolvedValue({
      total: 0,
      homeworkIds: [],
      completions: [],
    });

    await loadReads([11]);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(subscriptionFindManyMock).not.toHaveBeenCalled();
    expect(commentGroupByMock).not.toHaveBeenCalled();
  });

  it("rethrows a failed item_state stage", async () => {
    withHomeworkItemStateMock.mockRejectedValue(new Error("item state failed"));

    await expect(loadReads([11])).rejects.toThrow("item state failed");
  });
});
