import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, todoCountMock, todoFindManyMock, withUserDbContextMock } =
  vi.hoisted(() => {
    const queryRaw = vi.fn();
    const todoCount = vi.fn();
    const todoFindMany = vi.fn();
    const tx = {
      $queryRaw: queryRaw,
      todo: { count: todoCount, findMany: todoFindMany },
    };
    return {
      queryRawMock: queryRaw,
      todoCountMock: todoCount,
      todoFindManyMock: todoFindMany,
      withUserDbContextMock: vi.fn(
        async (_userId: string, action: (transaction: typeof tx) => unknown) =>
          action(tx),
      ),
    };
  });

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

describe("todo summary read model performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRawMock.mockResolvedValue([
      {
        completed: 3n,
        due_soon: 0n,
        incomplete: 5n,
        overdue: 2n,
      },
    ]);
    todoFindManyMock.mockResolvedValue([{ id: "todo-1" }]);
  });

  it("collapses three counts plus the list from four statements to two", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );
    const now = new Date("2026-08-14T08:00:00.000Z");

    const result = await listTodoSummary({
      filters: {
        completed: false,
        dueAfter: new Date("2026-08-01T00:00:00.000Z"),
        priority: "high",
      },
      now,
      userId: "user-1",
    });

    expect(result).toEqual({
      counts: { completed: 3, incomplete: 5, overdue: 2 },
      todos: [{ id: "todo-1" }],
    });
    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(queryRawMock).toHaveBeenCalledOnce();
    expect(todoFindManyMock).toHaveBeenCalledOnce();
    expect(todoCountMock).not.toHaveBeenCalled();
    expect(queryRawMock.mock.invocationCallOrder[0]).toBeLessThan(
      todoFindManyMock.mock.invocationCallOrder[0],
    );
    expect(todoFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: {
          completed: false,
          dueAt: { gte: new Date("2026-08-01T00:00:00.000Z") },
          priority: "high",
          userId: "user-1",
        },
      }),
    );
  });

  it("preserves an explicit smaller list limit", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );

    await listTodoSummary({ take: 25, userId: "user-1" });

    expect(todoFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });
});
