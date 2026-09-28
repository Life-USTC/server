import { afterEach, describe, expect, it, vi } from "vitest";
import { semanticContract } from "../../../shared/specifications/semantic-contract";
import { todoExpectation } from "../../../shared/specifications/todo";

const requireAuthMock = vi.fn();
const updateOwnedTodoMock = vi.fn();
const deleteOwnedTodoMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  updateOwnedTodo: updateOwnedTodoMock,
  deleteOwnedTodo: deleteOwnedTodoMock,
}));

function patchRequest(body: unknown) {
  return new Request("https://example.test/api/workspace/todos/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
}

function deleteRequest(body: unknown) {
  return new Request("https://example.test/api/workspace/todos/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
  });
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

const sampleTodo = {
  id: "todo-1",
  title: "Sample Todo",
  content: null,
  priority: "medium" as const,
  completed: true,
  dueAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("patchTodoBatchRoute", () => {
  it("todo.rest-batch-patch-bounds", async (context) => {
    const contract = await semanticContract(
      context.task.name,
      "collection_input",
    );
    contract.equal("/surface", "rest");
    contract.equal("/input", "items");
    contract.equal("/operation", "PATCH /api/workspace/todos/batch");
    const rule = await todoExpectation(
      "todo.rest-batch-patch-bounds",
      "collection_input",
    );
    expect(rule.surface).toBe("rest");
    expect(rule.operation).toBe("PATCH /api/workspace/todos/batch");
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    updateOwnedTodoMock.mockResolvedValue({ ok: true, todo: sampleTodo });
    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );
    const [method, path] = rule.operation.split(" ");
    const send = (ids: string[]) =>
      patchTodoBatchRoute(
        new Request(`https://example.test${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [rule.input]: ids.map((todoId) => ({ todoId, completed: true })),
          }),
        }),
      );
    for (const count of [rule.min_items, rule.max_items]) {
      updateOwnedTodoMock.mockClear();
      const response = await send(
        Array.from({ length: count }, (_, i) => `todo-${i}`),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).results).toHaveLength(count);
      expect(updateOwnedTodoMock).toHaveBeenCalledTimes(count);
      contract.equal(
        count === rule.min_items ? "/min_items" : "/max_items",
        updateOwnedTodoMock.mock.calls.length,
      );
    }
    for (const count of [rule.min_items - 1, rule.max_items + 1]) {
      updateOwnedTodoMock.mockClear();
      expect(
        (await send(Array.from({ length: count }, (_, i) => `todo-${i}`)))
          .status,
      ).toBe(400);
      expect(updateOwnedTodoMock).not.toHaveBeenCalled();
    }
    updateOwnedTodoMock.mockClear();
    const duplicateResponse = await send(["todo-duplicate", "todo-duplicate"]);
    expect(duplicateResponse.status).toBe(rule.unique_items ? 400 : 200);
    expect(updateOwnedTodoMock).toHaveBeenCalledTimes(
      rule.unique_items ? 0 : 2,
    );
    contract.equal("/unique_items", duplicateResponse.status === 400);
    contract.recordVitest(context);
  });

  afterEach(() => {
    requireAuthMock.mockReset();
    updateOwnedTodoMock.mockReset();
    deleteOwnedTodoMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(
      patchRequest({ items: [{ todoId: "todo-1", completed: true }] }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(updateOwnedTodoMock).not.toHaveBeenCalled();
  });

  it("成功批量更新 todo 完成状态并返回更新后实体", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    updateOwnedTodoMock
      .mockResolvedValueOnce({ ok: true, todo: sampleTodo })
      .mockResolvedValueOnce({
        ok: true,
        todo: { ...sampleTodo, id: "todo-2", completed: false },
      });

    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(
      patchRequest({
        items: [
          { todoId: "todo-1", completed: true },
          { todoId: "todo-2", completed: false },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toMatchObject({
      success: true,
      todoId: "todo-1",
      completed: true,
      todo: {
        id: "todo-1",
        completed: true,
        createdAt: "2026-01-01T08:00:00+08:00",
        updatedAt: "2026-01-01T08:00:00+08:00",
      },
    });
    expect(body.results[1]).toMatchObject({
      success: true,
      todoId: "todo-2",
      completed: false,
      todo: {
        id: "todo-2",
        completed: false,
        createdAt: "2026-01-01T08:00:00+08:00",
        updatedAt: "2026-01-01T08:00:00+08:00",
      },
    });
    expect(updateOwnedTodoMock).toHaveBeenCalledWith({
      id: "todo-1",
      userId: "user-1",
      data: { completed: true, dueAt: undefined, hasDueAt: false },
    });
    expect(updateOwnedTodoMock).toHaveBeenCalledWith({
      id: "todo-2",
      userId: "user-1",
      data: { completed: false, dueAt: undefined, hasDueAt: false },
    });
  });

  it("对找不到或非所有者 todo 返回失败项而不中断批量处理", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    updateOwnedTodoMock
      .mockResolvedValueOnce({ ok: true, todo: sampleTodo })
      .mockResolvedValueOnce({ ok: false, error: "not_found" })
      .mockResolvedValueOnce({ ok: false, error: "forbidden" });

    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(
      patchRequest({
        items: [
          { todoId: "todo-1", completed: true },
          { todoId: "todo-missing", completed: true },
          { todoId: "todo-owned-by-other", completed: false },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      {
        success: true,
        todoId: "todo-1",
        completed: true,
        todo: expect.objectContaining({ id: "todo-1" }),
      },
      {
        success: false,
        todoId: "todo-missing",
        completed: true,
        error: { code: "not_found", message: "not_found" },
      },
      {
        success: false,
        todoId: "todo-owned-by-other",
        completed: false,
        error: { code: "forbidden", message: "forbidden" },
      },
    ]);
  });

  it("拒绝无效批量 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(
      patchRequest({ items: [{ todoId: "", completed: true }] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(updateOwnedTodoMock).not.toHaveBeenCalled();
  });

  it("要求至少一个 item", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(patchRequest({ items: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
  });
});

describe("deleteTodoBatchRoute", () => {
  it("todo.rest-batch-delete-bounds", async (context) => {
    const contract = await semanticContract(
      context.task.name,
      "collection_input",
    );
    contract.equal("/surface", "rest");
    contract.equal("/input", "ids");
    contract.equal("/operation", "DELETE /api/workspace/todos/batch");
    const rule = await todoExpectation(
      "todo.rest-batch-delete-bounds",
      "collection_input",
    );
    expect(rule.surface).toBe("rest");
    expect(rule.operation).toBe("DELETE /api/workspace/todos/batch");
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnedTodoMock.mockResolvedValue({ ok: true });
    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );
    const [method, path] = rule.operation.split(" ");
    const send = (ids: string[]) =>
      deleteTodoBatchRoute(
        new Request(`https://example.test${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [rule.input]: ids }),
        }),
      );
    for (const count of [rule.min_items, rule.max_items]) {
      deleteOwnedTodoMock.mockClear();
      const response = await send(
        Array.from({ length: count }, (_, i) => `todo-${i}`),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).results).toHaveLength(count);
      expect(deleteOwnedTodoMock).toHaveBeenCalledTimes(count);
      contract.equal(
        count === rule.min_items ? "/min_items" : "/max_items",
        deleteOwnedTodoMock.mock.calls.length,
      );
    }
    for (const count of [rule.min_items - 1, rule.max_items + 1]) {
      deleteOwnedTodoMock.mockClear();
      expect(
        (await send(Array.from({ length: count }, (_, i) => `todo-${i}`)))
          .status,
      ).toBe(400);
      expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
    }
    deleteOwnedTodoMock.mockClear();
    const duplicateResponse = await send(["todo-duplicate", "todo-duplicate"]);
    expect(duplicateResponse.status).toBe(rule.unique_items ? 400 : 200);
    expect(deleteOwnedTodoMock).toHaveBeenCalledTimes(
      rule.unique_items ? 0 : 2,
    );
    contract.equal("/unique_items", duplicateResponse.status === 400);
    contract.recordVitest(context);
  });

  afterEach(() => {
    requireAuthMock.mockReset();
    deleteOwnedTodoMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await deleteTodoBatchRoute(
      deleteRequest({ ids: ["todo-1"] }),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });

  it("成功批量删除 todo 并返回成功项", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnedTodoMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await deleteTodoBatchRoute(
      deleteRequest({ ids: ["todo-1", "todo-2"] }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { success: true, id: "todo-1" },
      { success: true, id: "todo-2" },
    ]);
    expect(deleteOwnedTodoMock).toHaveBeenCalledWith("todo-1", "user-1");
    expect(deleteOwnedTodoMock).toHaveBeenCalledWith("todo-2", "user-1");
  });

  it("对找不到或非所有者 todo 返回失败项而不中断批量处理", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnedTodoMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "not_found" })
      .mockResolvedValueOnce({ ok: false, error: "forbidden" });

    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await deleteTodoBatchRoute(
      deleteRequest({ ids: ["todo-1", "todo-missing", "todo-owned-by-other"] }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { success: true, id: "todo-1" },
      {
        success: false,
        id: "todo-missing",
        error: { code: "not_found", message: "not_found" },
      },
      {
        success: false,
        id: "todo-owned-by-other",
        error: { code: "forbidden", message: "forbidden" },
      },
    ]);
  });

  it("拒绝空 ids 数组", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await deleteTodoBatchRoute(deleteRequest({ ids: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });

  it("拒绝包含空字符串 id 的 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const { deleteTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await deleteTodoBatchRoute(
      deleteRequest({ ids: ["todo-1", ""] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });
});
