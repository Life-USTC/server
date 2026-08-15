import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  examCountMock,
  examFindManyMock,
  getPrismaMock,
  homeworkCountMock,
  homeworkFindManyMock,
  scheduleCountMock,
  scheduleFindManyMock,
  sectionCountMock,
  sectionFindManyMock,
  todoCountMock,
  todoFindManyMock,
  userSectionSubscriptionFindManyMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  examCountMock: vi.fn(),
  examFindManyMock: vi.fn(),
  getPrismaMock: vi.fn(),
  homeworkCountMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  scheduleCountMock: vi.fn(),
  scheduleFindManyMock: vi.fn(),
  sectionCountMock: vi.fn(),
  sectionFindManyMock: vi.fn(),
  todoCountMock: vi.fn(),
  todoFindManyMock: vi.fn(),
  userSectionSubscriptionFindManyMock: vi.fn(),
  withUserDbContextMock: vi.fn(
    async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
      action({
        homework: {
          count: homeworkCountMock,
          findMany: homeworkFindManyMock,
        },
        todo: { count: todoCountMock, findMany: todoFindManyMock },
        userSectionSubscription: {
          findMany: userSectionSubscriptionFindManyMock,
        },
      }),
  ),
}));

const localizedPrisma = {
  exam: { count: examCountMock, findMany: examFindManyMock },
  homework: { count: homeworkCountMock, findMany: homeworkFindManyMock },
  schedule: { count: scheduleCountMock, findMany: scheduleFindManyMock },
  section: { count: sectionCountMock, findMany: sectionFindManyMock },
};

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: getPrismaMock,
  prisma: {
    comment: { groupBy: vi.fn() },
    todo: {
      count: vi.fn(() => {
        throw new Error(
          "base todo delegate must not be used inside RLS context",
        );
      }),
      findMany: vi.fn(() => {
        throw new Error(
          "base todo delegate must not be used inside RLS context",
        );
      }),
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

describe("viewer page services", () => {
  beforeEach(() => {
    for (const mock of [
      examCountMock,
      examFindManyMock,
      getPrismaMock,
      homeworkCountMock,
      homeworkFindManyMock,
      scheduleCountMock,
      scheduleFindManyMock,
      sectionCountMock,
      sectionFindManyMock,
      todoCountMock,
      todoFindManyMock,
      userSectionSubscriptionFindManyMock,
    ]) {
      mock.mockReset();
    }
    userSectionSubscriptionFindManyMock.mockImplementation(
      ({ where }: { where?: { section?: { semesterId?: number } } }) => {
        const semesterId = where?.section?.semesterId;
        if (semesterId === 7) return Promise.resolve([{ sectionId: 71 }]);
        if (semesterId === 8) return Promise.resolve([{ sectionId: 81 }]);
        if (semesterId === 9) return Promise.resolve([{ sectionId: 91 }]);
        return Promise.resolve([{ sectionId: 11 }]);
      },
    );
    getPrismaMock.mockReturnValue(localizedPrisma);
    for (const mock of [
      examFindManyMock,
      homeworkFindManyMock,
      scheduleFindManyMock,
      sectionFindManyMock,
      todoFindManyMock,
    ]) {
      mock.mockResolvedValue([]);
    }
    for (const mock of [
      examCountMock,
      homeworkCountMock,
      scheduleCountMock,
      sectionCountMock,
      todoCountMock,
    ]) {
      mock.mockResolvedValue(0);
    }
  });

  it("paginates todos with an owner-bound where shared by data and count", async () => {
    const dueAfter = new Date("2026-04-29T00:00:00.000Z");
    const { listTodoPage } = await import(
      "@/features/todos/server/todo-service"
    );

    await listTodoPage({
      filters: {
        completed: false,
        dueAfter,
        priority: "high",
      },
      pagination: { page: 2, pageSize: 3 },
      userId: "user-1",
    });

    const where = {
      userId: "user-1",
      completed: false,
      dueAt: { gte: dueAfter },
      priority: "high",
    };
    expect(todoFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 3, take: 3 }),
    );
    expect(todoCountMock).toHaveBeenCalledWith({ where });
  });

  it("paginates sections through the user subscription relation", async () => {
    const { listSubscribedSectionPage } = await import(
      "@/features/subscriptions/server/subscription-section-page"
    );

    await listSubscribedSectionPage("user-1", {
      locale: "en-us",
      pagination: { page: 2, pageSize: 4 },
    });

    const where = { id: { in: [11] } };
    expect(sectionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 4, take: 4 }),
    );
    expect(sectionCountMock).toHaveBeenCalledWith({ where });
  });

  it("paginates homeworks through the user subscription relation", async () => {
    const dueAtTo = new Date("2026-05-06T00:00:00.000Z");
    const { listSubscribedHomeworkPage } = await import(
      "@/features/subscriptions/server/subscription-homework-page"
    );

    await listSubscribedHomeworkPage("user-1", {
      completed: false,
      dueAtTo,
      pagination: { page: 2, pageSize: 5 },
      semesterId: 7,
    });

    const where = {
      section: {
        sectionSubscriptions: { some: { userId: "user-1" } },
        semesterId: 7,
      },
      deletedAt: null,
      homeworkCompletions: { none: { userId: "user-1" } },
      submissionDueAt: { lte: dueAtTo },
    };
    expect(homeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 5, take: 5 }),
    );
    expect(homeworkCountMock).toHaveBeenCalledWith({ where });
    expect(where).not.toHaveProperty("sectionId");
  });

  it("paginates schedules through the user subscription relation", async () => {
    const dateFrom = new Date("2026-04-29T00:00:00.000Z");
    const { listSubscribedSchedulePage } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedulePage("user-1", {
      dateFrom,
      pagination: { page: 3, pageSize: 2 },
      semesterId: 8,
      weekday: 3,
    });

    const where = {
      sectionId: { in: [81] },
      section: { retiredAt: null },
      date: { gte: dateFrom },
      weekday: 3,
    };
    expect(scheduleFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        include: expect.objectContaining({
          teachers: {
            select: expect.objectContaining({
              department: {
                select: expect.objectContaining({
                  id: true,
                  code: true,
                  isCollege: true,
                  nameCn: true,
                  nameEn: true,
                }),
              },
              teacherTitle: {
                select: expect.objectContaining({
                  id: true,
                  jwId: true,
                  code: true,
                  enabled: true,
                  nameCn: true,
                  nameEn: true,
                }),
              },
              _count: {
                select: {
                  sections: { where: { retiredAt: null } },
                },
              },
            }),
          },
        }),
        skip: 4,
        take: 2,
      }),
    );
    expect(scheduleCountMock).toHaveBeenCalledWith({ where });
  });

  it("paginates exams through the user subscription relation", async () => {
    const dateTo = new Date("2026-05-06T00:00:00.000Z");
    const { listSubscribedExamPage } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExamPage("user-1", {
      dateTo,
      includeDateUnknown: false,
      pagination: { page: 2, pageSize: 6 },
      semesterId: 9,
    });

    const where = {
      sectionId: { in: [91] },
      section: { retiredAt: null },
      OR: [{ examDate: { lte: dateTo } }],
    };
    expect(examFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 6, take: 6 }),
    );
    expect(examCountMock).toHaveBeenCalledWith({ where });
  });
});
