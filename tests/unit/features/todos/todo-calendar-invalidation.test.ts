import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";
import { bindDomainOperation } from "../../../shared/specifications/domain-contracts";
import {
  type SemanticContract,
  semanticContract,
} from "../../../shared/specifications/semantic-contract";

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

function observeCalendar(
  contract: SemanticContract,
  phase: string,
  count: number,
) {
  contract.equal(`/${phase}/0/operation`, {
    module: "src/features/calendar/server/calendar-export-invalidation.ts",
    export: "scheduleInvalidateUserCalendarExportCache",
  });
  contract.equal(`/${phase}/0/calls`, count);
}

describe("todo calendar export invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function holdUpdateCommit(contract: SemanticContract) {
    const update = bindDomainOperation(
      contract,
      "src/features/todos/server/todo-service.ts",
      updateOwnedTodo,
    );
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
    const pending = update({
      id: "todo-1",
      userId: "user-1",
      data: { completed: true, dueAt: undefined, hasDueAt: false },
    });
    return { callbackFinished, commit, pending };
  }

  it("todo.update-calendar-after-commit", async (context) => {
    const contract = await semanticContract(
      "todo.update-calendar-after-commit",
      "transaction_effects",
    );
    const { callbackFinished, commit, pending } = holdUpdateCommit(contract);
    await callbackFinished.promise;
    const callsBeforeCommit = invalidateMock.mock.calls.length;
    commit.resolve();
    const result = await pending;
    contract.equal("/completion", result.ok ? "commit" : "rejected");
    contract.equal("/failure_propagated", !result.ok);
    observeCalendar(contract, "before_commit", callsBeforeCommit);
    observeCalendar(
      contract,
      "after_completion",
      invalidateMock.mock.calls.length,
    );
    contract.recordVitest(context);
    expect(callsBeforeCommit).toBe(0);
    expect(invalidateMock).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("todo.update-calendar-rollback", async (context) => {
    const contract = await semanticContract(
      "todo.update-calendar-rollback",
      "transaction_effects",
    );
    const { callbackFinished, commit, pending } = holdUpdateCommit(contract);
    const outcome = pending.then(
      () => ({ completion: "commit", failed: false }),
      () => ({ completion: "rollback", failed: true }),
    );
    const rejected = expect(pending).rejects.toThrow("commit failed");
    await callbackFinished.promise;
    observeCalendar(
      contract,
      "before_commit",
      invalidateMock.mock.calls.length,
    );
    commit.reject(new Error("commit failed"));
    await rejected;
    const result = await outcome;
    contract.equal("/completion", result.completion);
    contract.equal("/failure_propagated", result.failed);
    observeCalendar(
      contract,
      "after_completion",
      invalidateMock.mock.calls.length,
    );
    contract.recordVitest(context);
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
