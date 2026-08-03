import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceOverviewStage } from "@/lib/metrics/analytics-engine";
import { DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
import { createDeferred } from "../shared/deferred";

const AT_TIME = new Date(DEV_SEED_ANCHOR.recommendedAtTime);
const TODAY_START = new Date(DEV_SEED_ANCHOR.startOfDayAtTime);
const TOMORROW_START = new Date(TODAY_START.getTime() + 24 * 60 * 60 * 1000);
const HOMEWORK_WINDOW_END = new Date("2026-05-06T08:00:00+08:00");

const {
  homeworkCountMock,
  listDueSoonSubscribedHomeworksWithCountMock,
  listTodaySubscribedSchedulesWithCountMock,
  listUpcomingSubscribedExamsWithCountMock,
  withHomeworkItemStateMock,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const homeworkCount = vi.fn();
  const tx = { homework: { count: homeworkCount } };
  return {
    homeworkCountMock: homeworkCount,
    listDueSoonSubscribedHomeworksWithCountMock: vi.fn(),
    listTodaySubscribedSchedulesWithCountMock: vi.fn(),
    listUpcomingSubscribedExamsWithCountMock: vi.fn(),
    withHomeworkItemStateMock: vi.fn(async (items: unknown[]) => items),
    withUserDbContextMock: vi.fn(async (_userId, action) => action(tx)),
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
  withUserDbContext: withUserDbContextMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", () => ({
  withHomeworkItemState: withHomeworkItemStateMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listDueSoonSubscribedHomeworksWithCount:
    listDueSoonSubscribedHomeworksWithCountMock,
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
    "@/features/dashboard/server/compact-overview-subscription-bundle"
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
    homeworkCountMock.mockResolvedValue(4);
    listTodaySubscribedSchedulesWithCountMock.mockResolvedValue({
      total: 1,
      items: [{ id: "schedule-1" }],
    });
    listDueSoonSubscribedHomeworksWithCountMock.mockResolvedValue({
      total: 2,
      items: [{ id: "homework-1" }],
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
    expect(listTodaySubscribedSchedulesWithCountMock).not.toHaveBeenCalled();
    expect(listDueSoonSubscribedHomeworksWithCountMock).not.toHaveBeenCalled();
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

    expect(listDueSoonSubscribedHomeworksWithCountMock).toHaveBeenCalledOnce();
    expect(listDueSoonSubscribedHomeworksWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        sectionIds: [11],
        dueAtFrom: AT_TIME,
        dueAtTo: HOMEWORK_WINDOW_END,
        limit: 3,
      }),
    );
    expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], limit: 3 }),
    );
    expect(listUpcomingSubscribedExamsWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], limit: 3 }),
    );
    expect(withUserDbContextMock).toHaveBeenCalledOnce();
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
    expect(listDueSoonSubscribedHomeworksWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], limit: 1 }),
    );
    expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], limit: 1 }),
    );
    expect(listUpcomingSubscribedExamsWithCountMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ sectionIds: [11], limit: 1 }),
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
    const { promise: homeworkPromise, resolve: resolveHomework } =
      createDeferred<{ total: number; items: Array<{ id: string }> }>();
    listDueSoonSubscribedHomeworksWithCountMock.mockReturnValue(
      homeworkPromise,
    );

    const readsPromise = loadReads([11]);

    await vi.waitFor(() => {
      expect(homeworkCountMock).toHaveBeenCalled();
      expect(listTodaySubscribedSchedulesWithCountMock).toHaveBeenCalled();
    });
    expect(withHomeworkItemStateMock).not.toHaveBeenCalled();
    resolveHomework({ total: 2, items: [{ id: "homework-1" }] });
    await readsPromise;
    expect(withHomeworkItemStateMock).toHaveBeenCalledWith(
      [{ id: "homework-1" }],
      "user-1",
    );
  });

  it("rethrows a failed item_state stage", async () => {
    withHomeworkItemStateMock.mockRejectedValue(new Error("item state failed"));

    await expect(loadReads([11])).rejects.toThrow("item state failed");
  });
});
