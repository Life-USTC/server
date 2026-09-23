import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  homeworkFindManyMock,
  homeworkFindUniqueMock,
  completionDeleteManyMock,
  completionUpsertMock,
  transaction,
  withUserDbContextMock,
} = vi.hoisted(() => {
  const homeworkFindMany = vi.fn();
  const homeworkFindUnique = vi.fn();
  const completionDeleteMany = vi.fn();
  const completionUpsert = vi.fn();
  const tx = {
    homework: {
      findMany: homeworkFindMany,
      findUnique: homeworkFindUnique,
    },
    homeworkCompletion: {
      deleteMany: completionDeleteMany,
      upsert: completionUpsert,
    },
  };
  return {
    homeworkFindManyMock: homeworkFindMany,
    homeworkFindUniqueMock: homeworkFindUnique,
    completionDeleteManyMock: completionDeleteMany,
    completionUpsertMock: completionUpsert,
    transaction: tx,
    withUserDbContextMock: vi.fn(
      async (
        _userId: string,
        action: (client: typeof tx) => Promise<unknown>,
      ) => action(tx),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

describe("homework completion owner context", () => {
  beforeEach(() => {
    homeworkFindManyMock.mockReset();
    homeworkFindUniqueMock.mockReset();
    completionDeleteManyMock.mockReset();
    completionUpsertMock.mockReset();
    withUserDbContextMock.mockClear();
  });

  it("validates and upserts through one owner transaction", async () => {
    const completedAt = new Date("2026-07-30T00:00:00.000Z");
    homeworkFindUniqueMock.mockResolvedValue({
      id: "homework-1",
      deletedAt: null,
    });
    completionUpsertMock.mockResolvedValue({ completedAt });
    const { setHomeworkCompletion } = await import(
      "@/features/homeworks/server/homework-completion"
    );

    await expect(
      setHomeworkCompletion({
        completed: true,
        homeworkId: "homework-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      success: true,
      homeworkId: "homework-1",
      completed: true,
      completedAt,
    });

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(homeworkFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "homework-1" },
      select: { id: true, deletedAt: true },
    });
    expect(completionUpsertMock).toHaveBeenCalledWith({
      where: {
        userId_homeworkId: {
          userId: "user-1",
          homeworkId: "homework-1",
        },
      },
      update: { completedAt: expect.any(Date) },
      create: { userId: "user-1", homeworkId: "homework-1" },
    });
    expect(transaction.homeworkCompletion.upsert).toBe(completionUpsertMock);
  });

  it("deletes only the owner record through the transaction client", async () => {
    homeworkFindUniqueMock.mockResolvedValue({
      id: "homework-1",
      deletedAt: null,
    });
    completionDeleteManyMock.mockResolvedValue({ count: 1 });
    const { setHomeworkCompletion } = await import(
      "@/features/homeworks/server/homework-completion"
    );

    await expect(
      setHomeworkCompletion({
        completed: false,
        homeworkId: "homework-1",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({ success: true, completed: false });
    expect(completionDeleteManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1", homeworkId: "homework-1" },
    });
  });

  it("keeps batch validation and writes inside one owner transaction", async () => {
    homeworkFindManyMock.mockResolvedValue([
      { id: "active", deletedAt: null },
      { id: "deleted", deletedAt: new Date("2026-07-29T00:00:00.000Z") },
    ]);
    completionUpsertMock.mockResolvedValue({
      completedAt: new Date("2026-07-30T00:00:00.000Z"),
    });
    const { setHomeworkCompletions } = await import(
      "@/features/homeworks/server/homework-completion"
    );

    const result = await setHomeworkCompletions({
      userId: "user-1",
      items: [
        { homeworkId: "active", completed: true },
        { homeworkId: "deleted", completed: true },
        { homeworkId: "missing", completed: false },
      ],
    });

    expect(withUserDbContextMock).toHaveBeenCalledTimes(1);
    expect(completionUpsertMock).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual([
      expect.objectContaining({ success: true, homeworkId: "active" }),
      expect.objectContaining({
        success: false,
        homeworkId: "deleted",
        error: expect.objectContaining({ code: "deleted" }),
      }),
      expect.objectContaining({
        success: false,
        homeworkId: "missing",
        error: expect.objectContaining({ code: "not_found" }),
      }),
    ]);
  });
});
