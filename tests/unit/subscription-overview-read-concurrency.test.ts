import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../shared/deferred";

const {
  examCountMock,
  examFindManyMock,
  scheduleCountMock,
  scheduleFindManyMock,
} = vi.hoisted(() => ({
  examCountMock: vi.fn(),
  examFindManyMock: vi.fn(),
  scheduleCountMock: vi.fn(),
  scheduleFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    exam: { count: examCountMock, findMany: examFindManyMock },
    schedule: { count: scheduleCountMock, findMany: scheduleFindManyMock },
  })),
  prisma: { exam: { count: examCountMock } },
}));

vi.mock(
  "@/features/subscriptions/server/subscription-read-model-shared",
  () => ({
    getSubscribedSectionIds: vi.fn(),
    getSubscribedSectionIdsForSemester: vi.fn(),
    withSubscribedSections: vi.fn(
      async (
        _userId: string,
        action: (ids: number[]) => Promise<unknown>,
        sectionIds?: readonly number[],
      ) => action(Array.from(sectionIds ?? [])),
    ),
  }),
);

describe("subscription overview count and sample reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the schedule sample without waiting for the count", async () => {
    const { promise: countPromise, resolve: resolveCount } =
      createDeferred<number>();
    scheduleCountMock.mockReturnValue(countPromise);
    scheduleFindManyMock.mockResolvedValue([{ id: 101 }]);
    const { listTodaySubscribedSchedulesWithCount } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    const resultPromise = listTodaySubscribedSchedulesWithCount("user-1", {
      todayStart: new Date("2026-05-01T00:00:00+08:00"),
      tomorrowStart: new Date("2026-05-02T00:00:00+08:00"),
      limit: 3,
      sectionIds: [11],
    });

    await vi.waitFor(() => expect(scheduleFindManyMock).toHaveBeenCalledOnce());
    resolveCount(4);
    await expect(resultPromise).resolves.toEqual({
      total: 4,
      items: [{ id: 101 }],
    });
  });

  it("starts the exam sample without waiting for the count", async () => {
    const { promise: countPromise, resolve: resolveCount } =
      createDeferred<number>();
    examCountMock.mockReturnValue(countPromise);
    examFindManyMock.mockResolvedValue([{ id: 201 }]);
    const { listUpcomingSubscribedExamsWithCount } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    const resultPromise = listUpcomingSubscribedExamsWithCount("user-1", {
      atTime: new Date("2026-05-01T10:00:00+08:00"),
      limit: 3,
      sectionIds: [11],
    });

    await vi.waitFor(() => expect(examFindManyMock).toHaveBeenCalledOnce());
    resolveCount(5);
    await expect(resultPromise).resolves.toEqual({
      total: 5,
      items: [{ id: 201 }],
    });
  });
});
