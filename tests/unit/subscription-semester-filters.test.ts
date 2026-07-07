import { afterEach, describe, expect, it, vi } from "vitest";

const {
  examFindManyMock,
  homeworkFindManyMock,
  scheduleFindManyMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  examFindManyMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
  scheduleFindManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    exam: { findMany: examFindManyMock },
    homework: { findMany: homeworkFindManyMock },
    schedule: { findMany: scheduleFindManyMock },
  })),
  prisma: {
    user: { findUnique: userFindUniqueMock },
  },
}));

describe("subscription semester filters", () => {
  afterEach(() => {
    examFindManyMock.mockReset();
    homeworkFindManyMock.mockReset();
    scheduleFindManyMock.mockReset();
    userFindUniqueMock.mockReset();
    vi.resetModules();
  });

  it("listSubscribedHomeworks resolves subscribed sections for the requested semester", async () => {
    userFindUniqueMock.mockResolvedValue({
      subscribedSections: [{ id: 101 }, { id: 102 }],
    });
    homeworkFindManyMock.mockResolvedValue([]);
    const { listSubscribedHomeworks } = await import(
      "@/features/subscriptions/server/subscription-homework-list"
    );

    await listSubscribedHomeworks("user-1", { semesterId: 7 });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        subscribedSections: {
          where: { semesterId: 7 },
          select: { id: true },
        },
      },
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
    userFindUniqueMock.mockResolvedValue({
      subscribedSections: [{ id: 201 }, { id: 202 }],
    });
    scheduleFindManyMock.mockResolvedValue([]);
    const { listSubscribedSchedules } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedules("user-1", { semesterId: 8 });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        subscribedSections: {
          where: { semesterId: 8 },
          select: { id: true },
        },
      },
    });
    expect(scheduleFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [201, 202] },
        }),
      }),
    );
  });

  it("listSubscribedExams resolves subscribed sections for the requested semester", async () => {
    userFindUniqueMock.mockResolvedValue({
      subscribedSections: [{ id: 301 }, { id: 302 }],
    });
    examFindManyMock.mockResolvedValue([]);
    const { listSubscribedExams } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExams("user-1", { semesterId: 9 });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        subscribedSections: {
          where: { semesterId: 9 },
          select: { id: true },
        },
      },
    });
    expect(examFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sectionId: { in: [301, 302] },
        }),
      }),
    );
  });
});
