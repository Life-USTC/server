import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completionFindManyMock,
  homeworkFindUniqueMock,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const completionFindMany = vi.fn();
  return {
    completionFindManyMock: completionFindMany,
    homeworkFindUniqueMock: vi.fn(),
    withUserDbContextMock: vi.fn(
      async (
        _userId: string,
        action: (tx: {
          homeworkCompletion: { findMany: typeof completionFindMany };
        }) => Promise<unknown>,
      ) => action({ homeworkCompletion: { findMany: completionFindMany } }),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    homework: { findUnique: homeworkFindUniqueMock },
  })),
  withUserDbContext: withUserDbContextMock,
}));

describe("homework read model owner context", () => {
  beforeEach(() => {
    completionFindManyMock.mockReset();
    homeworkFindUniqueMock.mockReset();
    withUserDbContextMock.mockClear();
  });

  it("loads signed-in viewer completion through the owner transaction", async () => {
    const completedAt = new Date("2026-07-30T00:00:00.000Z");
    homeworkFindUniqueMock.mockResolvedValue({
      id: "homework-1",
      _count: { comments: 2 },
    });
    completionFindManyMock.mockResolvedValue([
      { homeworkId: "homework-1", completedAt },
    ]);
    const { getHomeworkItemById } = await import(
      "@/features/homeworks/server/homework-read-model"
    );

    await expect(
      getHomeworkItemById({
        homeworkId: "homework-1",
        locale: "zh-cn",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      id: "homework-1",
      completion: { completedAt },
      commentCount: 2,
    });

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(completionFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        homeworkId: { in: ["homework-1"] },
      },
      select: { homeworkId: true, completedAt: true },
    });
    expect(homeworkFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.not.objectContaining({
          homeworkCompletions: expect.anything(),
        }),
      }),
    );
  });

  it("does not access completion rows for an anonymous viewer", async () => {
    homeworkFindUniqueMock.mockResolvedValue({
      id: "homework-1",
      _count: { comments: 0 },
    });
    const { getHomeworkItemById } = await import(
      "@/features/homeworks/server/homework-read-model"
    );

    await expect(
      getHomeworkItemById({
        homeworkId: "homework-1",
        locale: "zh-cn",
      }),
    ).resolves.toMatchObject({ completion: null, commentCount: 0 });
    expect(withUserDbContextMock).not.toHaveBeenCalled();
    expect(completionFindManyMock).not.toHaveBeenCalled();
  });
});
