import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const updateOwnedTodoMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  updateOwnedTodo: updateOwnedTodoMock,
}));

function jsonRequest(body: unknown) {
  return new Request("https://example.test/api/todos/batch", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
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
  afterEach(() => {
    requireAuthMock.mockReset();
    updateOwnedTodoMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchTodoBatchRoute } = await import(
      "@/lib/api/routes/todo-batch-route"
    );

    const response = await patchTodoBatchRoute(
      jsonRequest({ items: [{ todoId: "todo-1", completed: true }] }),
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
      jsonRequest({
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
      jsonRequest({
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
      jsonRequest({ items: [{ todoId: "", completed: true }] }),
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

    const response = await patchTodoBatchRoute(jsonRequest({ items: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
  });
});
