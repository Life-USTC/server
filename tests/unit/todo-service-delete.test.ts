import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteOwnedTodo } from "@/features/todos/server/todo-service";

const { todoDeleteManyMock, todoFindUniqueMock, withUserDbContextMock } =
  vi.hoisted(() => ({
    todoDeleteManyMock: vi.fn(),
    todoFindUniqueMock: vi.fn(),
    withUserDbContextMock: vi.fn(
      async (_userId: string, action: () => Promise<unknown>) => action(),
    ),
  }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    todo: {
      deleteMany: todoDeleteManyMock,
      findUnique: todoFindUniqueMock,
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

describe("deleteOwnedTodo", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deletes by id and owner in one write", async () => {
    todoDeleteManyMock.mockResolvedValue({ count: 1 });

    await expect(deleteOwnedTodo("todo-1", "user-1")).resolves.toEqual({
      ok: true,
    });

    expect(todoDeleteManyMock).toHaveBeenCalledWith({
      where: { id: "todo-1", userId: "user-1" },
    });
    expect(todoFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns not_found when the todo is already gone", async () => {
    todoDeleteManyMock.mockResolvedValue({ count: 0 });
    todoFindUniqueMock.mockResolvedValue(null);

    await expect(deleteOwnedTodo("todo-1", "user-1")).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns forbidden when another user owns the todo", async () => {
    todoDeleteManyMock.mockResolvedValue({ count: 0 });
    todoFindUniqueMock.mockResolvedValue({ id: "todo-1", userId: "user-2" });

    await expect(deleteOwnedTodo("todo-1", "user-1")).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("treats stale same-user ownership reads as already deleted", async () => {
    todoDeleteManyMock.mockResolvedValue({ count: 0 });
    todoFindUniqueMock.mockResolvedValue({ id: "todo-1", userId: "user-1" });

    await expect(deleteOwnedTodo("todo-1", "user-1")).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
