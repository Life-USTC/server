import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

const { invalidateMock, withUserDbContextMock } = vi.hoisted(() => ({
  invalidateMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateUserCalendarExportCache: invalidateMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import {
  createTodo,
  deleteOwnedTodo,
  updateOwnedTodo,
} from "@/features/todos/server/todo-service";

describe("todo calendar export invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function holdUpdateCommit() {
    const commit = createDeferred();
    const callbackFinished = createDeferred();
    withUserDbContextMock.mockImplementation(async (_userId, work) => {
      const result = await work({
        todo: {
          findUnique: async () => ({ id: "todo-1", userId: "user-1" }),
          update: async () => ({ id: "todo-1", completed: true }),
        },
      });
      callbackFinished.resolve();
      await commit.promise;
      return result;
    });
    const pending = updateOwnedTodo({
      id: "todo-1",
      userId: "user-1",
      data: { completed: true, dueAt: undefined, hasDueAt: false },
    });
    return { callbackFinished, commit, pending };
  }

  it("does not enqueue a rebuild until the update transaction commits", async () => {
    const { callbackFinished, commit, pending } = holdUpdateCommit();
    await callbackFinished.promise;
    const callsBeforeCommit = invalidateMock.mock.calls.length;
    commit.resolve();
    await pending;
    expect(callsBeforeCommit).toBe(0);
    expect(invalidateMock).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("does not enqueue a rebuild when the update transaction rolls back", async () => {
    const { callbackFinished, commit, pending } = holdUpdateCommit();
    const rejected = expect(pending).rejects.toThrow("commit failed");
    await callbackFinished.promise;
    commit.reject(new Error("commit failed"));
    await rejected;
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("invalidates calendar cache after creating a todo", async () => {
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          todo: {
            create: vi.fn().mockResolvedValue({ id: "todo-1" }),
          },
        }),
    );

    await createTodo({
      userId: "user-1",
      title: "Read chapter 1",
    });

    expect(invalidateMock).toHaveBeenCalledWith("user-1");
  });

  it("invalidates calendar cache after updating a todo", async () => {
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          todo: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ id: "todo-1", userId: "user-1" }),
            update: vi.fn().mockResolvedValue({
              id: "todo-1",
              title: "Updated",
              content: null,
              priority: "medium",
              dueAt: new Date(),
              completed: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        }),
    );

    const result = await updateOwnedTodo({
      id: "todo-1",
      userId: "user-1",
      data: {
        title: "Updated",
        dueAt: undefined,
        hasDueAt: false,
      },
    });

    expect(result.ok).toBe(true);
    expect(invalidateMock).toHaveBeenCalledWith("user-1");
  });

  it("invalidates calendar cache after deleting a todo", async () => {
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          todo: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        }),
    );

    const result = await deleteOwnedTodo("todo-1", "user-1");

    expect(result.ok).toBe(true);
    expect(invalidateMock).toHaveBeenCalledWith("user-1");
  });
});
