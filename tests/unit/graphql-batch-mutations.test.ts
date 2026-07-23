import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphqlContext } from "@/lib/graphql/context";
import { graphqlMutationResolvers } from "@/lib/graphql/mutations";

const {
  batchUpdateUserSectionSubscriptionsMock,
  deleteOwnedTodoMock,
  requireGraphqlMutationMock,
  setHomeworkCompletionsMock,
  updateOwnedTodoMock,
} = vi.hoisted(() => ({
  batchUpdateUserSectionSubscriptionsMock: vi.fn(),
  deleteOwnedTodoMock: vi.fn(),
  requireGraphqlMutationMock: vi.fn(),
  setHomeworkCompletionsMock: vi.fn(),
  updateOwnedTodoMock: vi.fn(),
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  createTodo: vi.fn(),
  deleteOwnedTodo: deleteOwnedTodoMock,
  updateOwnedTodo: updateOwnedTodoMock,
}));

vi.mock("@/features/homeworks/server/homework-completion", () => ({
  setHomeworkCompletion: vi.fn(),
  setHomeworkCompletions: setHomeworkCompletionsMock,
}));

vi.mock("@/features/subscriptions/server/subscriptions", () => ({
  batchUpdateUserSectionSubscriptions: batchUpdateUserSectionSubscriptionsMock,
  setUserSectionSubscriptionByJwId: vi.fn(),
}));

vi.mock("@/lib/graphql/mutation-guard", () => ({
  requireGraphqlMutation: requireGraphqlMutationMock,
}));

const context = {
  locale: "en-us",
  principal: { kind: "anonymous" },
  request: new Request("https://life.example/api/graphql"),
} as unknown as GraphqlContext;

describe("GraphQL batch mutation resolvers", () => {
  beforeEach(() => {
    batchUpdateUserSectionSubscriptionsMock.mockReset();
    deleteOwnedTodoMock.mockReset();
    requireGraphqlMutationMock.mockReset();
    setHomeworkCompletionsMock.mockReset();
    updateOwnedTodoMock.mockReset();
    requireGraphqlMutationMock.mockResolvedValue({ userId: "user-1" });
  });

  it("preserves todo completion per-item partial success", async () => {
    const todo = {
      id: "todo-1",
      title: "Todo",
      content: null,
      priority: "medium",
      completed: true,
      dueAt: null,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    updateOwnedTodoMock
      .mockResolvedValueOnce({ ok: true, todo })
      .mockResolvedValueOnce({ ok: false, error: "forbidden" });

    const result = await graphqlMutationResolvers.Mutation.todoCompletionsSet(
      null,
      {
        items: [
          { todoId: " todo-1 ", completed: true },
          { todoId: "todo-2", completed: false },
        ],
      },
      context,
    );

    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(context, "todo", {
      rateLimitTier: "batch",
    });
    expect(updateOwnedTodoMock).toHaveBeenNthCalledWith(1, {
      id: "todo-1",
      userId: "user-1",
      data: { completed: true, dueAt: undefined, hasDueAt: false },
    });
    expect(result).toEqual({
      results: [
        {
          success: true,
          todoId: "todo-1",
          completed: true,
          todo,
        },
        {
          success: false,
          todoId: "todo-2",
          completed: false,
          error: { code: "forbidden", message: "forbidden" },
        },
      ],
    });
  });

  it.each([
    {
      call: () =>
        graphqlMutationResolvers.Mutation.todoCompletionsSet(
          null,
          {
            items: [
              { todoId: "todo-1", completed: true },
              { todoId: " todo-1 ", completed: false },
            ],
          },
          context,
        ),
      service: updateOwnedTodoMock,
      message: "todo IDs must not contain duplicate targets.",
    },
    {
      call: () =>
        graphqlMutationResolvers.Mutation.todosDelete(
          null,
          { ids: ["todo-1", " todo-1 "] },
          context,
        ),
      service: deleteOwnedTodoMock,
      message: "todo IDs must not contain duplicate targets.",
    },
    {
      call: () =>
        graphqlMutationResolvers.Mutation.homeworkCompletionsSet(
          null,
          {
            items: [
              { homeworkId: "homework-1", completed: true },
              { homeworkId: " homework-1 ", completed: false },
            ],
          },
          context,
        ),
      service: setHomeworkCompletionsMock,
      message: "homework IDs must not contain duplicate targets.",
    },
  ])("rejects duplicate targets before calling the service", async (testCase) => {
    await expect(testCase.call()).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
      message: testCase.message,
    });
    expect(testCase.service).not.toHaveBeenCalled();
  });

  it.each([
    {
      call: () =>
        graphqlMutationResolvers.Mutation.todoCompletionsSet(
          null,
          { items: [] },
          context,
        ),
      service: updateOwnedTodoMock,
      message: "todo IDs must contain 1-100 items.",
    },
    {
      call: () =>
        graphqlMutationResolvers.Mutation.todosDelete(
          null,
          { ids: Array.from({ length: 101 }, (_, index) => `todo-${index}`) },
          context,
        ),
      service: deleteOwnedTodoMock,
      message: "todo IDs must contain 1-100 items.",
    },
    {
      call: () =>
        graphqlMutationResolvers.Mutation.homeworkCompletionsSet(
          null,
          { items: [] },
          context,
        ),
      service: setHomeworkCompletionsMock,
      message: "homework IDs must contain 1-100 items.",
    },
  ])("enforces the documented batch bounds", async (testCase) => {
    await expect(testCase.call()).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
      message: testCase.message,
    });
    expect(testCase.service).not.toHaveBeenCalled();
  });

  it("delegates one normalized homework batch to the shared service", async () => {
    const payload = {
      results: [
        {
          success: false,
          homeworkId: "homework-missing",
          completed: true,
          error: { code: "not_found", message: "Homework not found" },
        },
      ],
    };
    setHomeworkCompletionsMock.mockResolvedValue(payload);

    await expect(
      graphqlMutationResolvers.Mutation.homeworkCompletionsSet(
        null,
        {
          items: [{ homeworkId: " homework-missing ", completed: true }],
        },
        context,
      ),
    ).resolves.toEqual(payload);
    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(
      context,
      "homework",
      { rateLimitTier: "batch" },
    );
    expect(setHomeworkCompletionsMock).toHaveBeenCalledWith({
      items: [{ homeworkId: "homework-missing", completed: true }],
      userId: "user-1",
    });
  });

  it("reuses subscription batch semantics and returns unmatched codes", async () => {
    batchUpdateUserSectionSubscriptionsMock.mockResolvedValue({
      action: "add",
      semester: { id: 7 },
      matchedCodes: ["MATH1001"],
      unmatchedCodes: ["UNKNOWN"],
      addedCount: 2,
      removedCount: 0,
      unchangedCount: 1,
      total: 3,
    });

    const result = await graphqlMutationResolvers.Mutation.subscriptionsImport(
      null,
      {
        input: {
          action: "add",
          codes: [" MATH1001 ", "UNKNOWN"],
          semesterId: 7,
        },
      },
      context,
    );

    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(
      context,
      "subscription",
      { rateLimitTier: "batch" },
    );
    expect(batchUpdateUserSectionSubscriptionsMock).toHaveBeenCalledWith({
      action: "add",
      codes: ["MATH1001", "UNKNOWN"],
      locale: "en-us",
      semesterId: 7,
      userId: "user-1",
    });
    expect(result).toEqual({
      action: "add",
      semesterId: 7,
      matchedCodes: ["MATH1001"],
      unmatchedCodes: ["UNKNOWN"],
      addedCount: 2,
      removedCount: 0,
      unchangedCount: 1,
      total: 3,
    });
  });

  it.each([
    {
      input: { action: "add" as const, codes: [] },
      message: "codes must contain at least one item.",
    },
    {
      input: { action: "set" as const, codes: ["MATH1001"] },
      message: "semesterId is required when action is SET.",
    },
    {
      input: {
        action: "add" as const,
        codes: ["math1001", " MATH1001 "],
      },
      message: "codes must not contain duplicate targets.",
    },
    {
      input: {
        action: "add" as const,
        codes: ["MATH1001"],
        semesterId: null,
      },
      message: "semesterId must not be null.",
    },
    {
      input: {
        action: "add" as const,
        codes: Array.from({ length: 501 }, (_, index) => `CODE-${index}`),
      },
      message: "codes must contain at most 500 items.",
    },
  ])("rejects ambiguous subscription batches", async ({ input, message }) => {
    await expect(
      graphqlMutationResolvers.Mutation.subscriptionsImport(
        null,
        { input },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
      message,
    });
    expect(batchUpdateUserSectionSubscriptionsMock).not.toHaveBeenCalled();
  });

  it("allows an empty SET target to clear one semester", async () => {
    batchUpdateUserSectionSubscriptionsMock.mockResolvedValue({
      action: "set",
      semester: { id: 7 },
      matchedCodes: [],
      unmatchedCodes: [],
      addedCount: 0,
      removedCount: 2,
      unchangedCount: 0,
      total: 0,
    });

    await graphqlMutationResolvers.Mutation.subscriptionsImport(
      null,
      { input: { action: "set", codes: [], semesterId: 7 } },
      context,
    );

    expect(batchUpdateUserSectionSubscriptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "set",
        codes: [],
        semesterId: 7,
      }),
    );
  });
});
