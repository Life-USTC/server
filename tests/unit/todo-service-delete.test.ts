import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTodo,
  deleteOwnedTodo,
} from "@/features/todos/server/todo-service";

const {
  todoCreateMock,
  todoDeleteManyMock,
  todoFindUniqueMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  todoCreateMock: vi.fn(),
  todoDeleteManyMock: vi.fn(),
  todoFindUniqueMock: vi.fn(),
  withUserDbContextMock: vi.fn(
    async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
      action({}),
  ),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    todo: {
      create: todoCreateMock,
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

  it("uses one normalized owner ID for context and writes", async () => {
    todoCreateMock.mockResolvedValue({ id: "todo-1" });

    await createTodo({ title: "Todo", userId: " user-1 " });

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(todoCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1" }),
      }),
    );
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
