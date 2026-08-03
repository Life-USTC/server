import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completionFindManyMock,
  localizedHomeworkFindManyMock,
  scopedHomeworkFindManyMock,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const completionFindMany = vi.fn();
  const scopedHomeworkFindMany = vi.fn();
  const tx = {
    homework: { findMany: scopedHomeworkFindMany },
    homeworkCompletion: { findMany: completionFindMany },
  };
  return {
    completionFindManyMock: completionFindMany,
    localizedHomeworkFindManyMock: vi.fn(),
    scopedHomeworkFindManyMock: scopedHomeworkFindMany,
    withUserDbContextMock: vi.fn(
      async (
        _userId: string,
        action: (client: typeof tx) => Promise<unknown>,
      ) => action(tx),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    homework: { findMany: localizedHomeworkFindManyMock },
  })),
  prisma: {},
  withUserDbContext: withUserDbContextMock,
}));

describe("subscribed homework owner context", () => {
  beforeEach(() => {
    completionFindManyMock.mockReset();
    localizedHomeworkFindManyMock.mockReset();
    scopedHomeworkFindManyMock.mockReset();
    withUserDbContextMock.mockClear();
  });

  it("filters IDs in owner context, then attaches owner completions to localized rows", async () => {
    const completedAt = new Date("2026-07-30T00:00:00.000Z");
    scopedHomeworkFindManyMock.mockResolvedValue([
      { id: "homework-2" },
      { id: "homework-1" },
    ]);
    localizedHomeworkFindManyMock.mockResolvedValue([
      { id: "homework-1" },
      { id: "homework-2" },
    ]);
    completionFindManyMock.mockResolvedValue([
      { homeworkId: "homework-1", completedAt },
    ]);
    const { listSubscribedHomeworks } = await import(
      "@/features/subscriptions/server/subscription-homework-list"
    );

    const homeworks = await listSubscribedHomeworks("user-1", {
      completed: false,
      sectionIds: [7],
      shape: "dashboard",
    });

    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(scopedHomeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          homeworkCompletions: { none: { userId: "user-1" } },
          sectionId: { in: [7] },
        }),
        select: { id: true },
      }),
    );
    expect(completionFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        homeworkId: { in: ["homework-2", "homework-1"] },
      },
      select: { homeworkId: true, completedAt: true },
    });
    expect(localizedHomeworkFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["homework-2", "homework-1"] } },
      select: expect.not.objectContaining({
        homeworkCompletions: expect.anything(),
      }),
    });
    expect(homeworks.map((homework) => homework.id)).toEqual([
      "homework-2",
      "homework-1",
    ]);
    expect(homeworks[0].homeworkCompletions).toEqual([]);
    expect(homeworks[1].homeworkCompletions).toEqual([{ completedAt }]);
  });
});
