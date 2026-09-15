import { afterEach, describe, expect, it, vi } from "vitest";

const {
  examFindManyMock,
  homeworkFindManyMock,
  scheduleFindManyMock,
  userSectionSubscriptionFindManyMock,
} = vi.hoisted(() => ({
  examFindManyMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  scheduleFindManyMock: vi.fn(),
  userSectionSubscriptionFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    exam: { findMany: examFindManyMock },
    homework: { findMany: homeworkFindManyMock },
    schedule: { findMany: scheduleFindManyMock },
  })),
  prisma: {
    userSectionSubscription: {
      findMany: userSectionSubscriptionFindManyMock,
    },
  },
  withUserDbContext: vi.fn(
    async (
      _userId: string,
      action: (tx: {
        homework: { findMany: typeof homeworkFindManyMock };
        userSectionSubscription: {
          findMany: typeof userSectionSubscriptionFindManyMock;
        };
      }) => Promise<unknown>,
    ) =>
      action({
        homework: { findMany: homeworkFindManyMock },
        userSectionSubscription: {
          findMany: userSectionSubscriptionFindManyMock,
        },
      }),
  ),
}));

describe("subscription semester filters", () => {
  afterEach(() => {
    examFindManyMock.mockReset();
    homeworkFindManyMock.mockReset();
    scheduleFindManyMock.mockReset();
    userSectionSubscriptionFindManyMock.mockReset();
    vi.resetModules();
  });

  it("listSubscribedHomeworks resolves subscribed sections for the requested semester", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([
      { sectionId: 101 },
      { sectionId: 102 },
    ]);
    homeworkFindManyMock.mockResolvedValue([]);
    const { listSubscribedHomeworks } = await import(
      "@/features/subscriptions/server/subscription-homework-list"
    );

    await listSubscribedHomeworks("user-1", { semesterId: 7 });

    expect(userSectionSubscriptionFindManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", section: { semesterId: 7 } },
      select: { sectionId: true },
    });
    expect(homeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [101, 102] },
        }),
      }),
    );
  });

  it("listSubscribedSchedules resolves subscribed sections for the requested semester", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([
      { sectionId: 201 },
      { sectionId: 202 },
    ]);
    scheduleFindManyMock.mockResolvedValue([]);
    const { listSubscribedSchedules } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedules("user-1", { semesterId: 8 });

    expect(userSectionSubscriptionFindManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", section: { semesterId: 8 } },
      select: { sectionId: true },
    });
    expect(scheduleFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [201, 202] },
          section: { retiredAt: null },
        }),
      }),
    );
  });

  it("listSubscribedExams resolves subscribed sections for the requested semester", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([
      { sectionId: 301 },
      { sectionId: 302 },
    ]);
    examFindManyMock.mockResolvedValue([]);
    const { listSubscribedExams } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExams("user-1", { semesterId: 9 });

    expect(userSectionSubscriptionFindManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", section: { semesterId: 9 } },
      select: { sectionId: true },
    });
    expect(examFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [301, 302] },
          section: { retiredAt: null },
        }),
      }),
    );
  });
});
