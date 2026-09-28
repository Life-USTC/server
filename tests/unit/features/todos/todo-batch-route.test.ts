import { afterEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, updateOwnedTodoMock, deleteOwnedTodoMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    updateOwnedTodoMock: vi.fn(),
    deleteOwnedTodoMock: vi.fn(),
  }));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  updateOwnedTodo: updateOwnedTodoMock,
  deleteOwnedTodo: deleteOwnedTodoMock,
}));

import {
  deleteTodoBatchRoute,
  patchTodoBatchRoute,
} from "@/lib/api/routes/todo-batch-route";

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
  it.each([1, 100])("accepts %s unique items", async (count) => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    updateOwnedTodoMock.mockResolvedValue({ ok: true, todo: sampleTodo });
    const ids = Array.from({ length: count }, (_, index) => `todo-${index}`);
    const response = await patchTodoBatchRoute(
      patchRequest({
        items: ids.map((todoId) => ({ todoId, completed: true })),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).results).toHaveLength(count);
    expect(updateOwnedTodoMock).toHaveBeenCalledTimes(count);
  });

  it.each([
    {
      name: "more than 100 targets",
      ids: Array.from({ length: 101 }, (_, index) => `todo-${index}`),
    },
    { name: "duplicate targets", ids: ["todo-duplicate", "todo-duplicate"] },
    {
      name: "duplicate normalized targets",
      ids: ["todo-duplicate", " todo-duplicate "],
    },
  ])("rejects $name before any mutation", async ({ ids }) => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    const response = await patchTodoBatchRoute(
      patchRequest({
        items: ids.map((todoId) => ({ todoId, completed: true })),
      }),
    );
    expect(response.status).toBe(400);
    expect(updateOwnedTodoMock).not.toHaveBeenCalled();
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    requireAuthMock.mockReset();
    updateOwnedTodoMock.mockReset();
    deleteOwnedTodoMock.mockReset();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());

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

    const response = await patchTodoBatchRoute(patchRequest({ items: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
  });
});

describe("deleteTodoBatchRoute", () => {
  it.each([1, 100])("accepts %s unique items", async (count) => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    deleteOwnedTodoMock.mockResolvedValue({ ok: true });
    const ids = Array.from({ length: count }, (_, index) => `todo-${index}`);
    const response = await deleteTodoBatchRoute(deleteRequest({ ids }));
    expect(response.status).toBe(200);
    expect((await response.json()).results).toHaveLength(count);
    expect(deleteOwnedTodoMock).toHaveBeenCalledTimes(count);
  });

  it.each([
    {
      name: "more than 100 targets",
      ids: Array.from({ length: 101 }, (_, index) => `todo-${index}`),
    },
    { name: "duplicate targets", ids: ["todo-duplicate", "todo-duplicate"] },
    {
      name: "duplicate normalized targets",
      ids: ["todo-duplicate", " todo-duplicate "],
    },
  ])("rejects $name before any mutation", async ({ ids }) => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    const response = await deleteTodoBatchRoute(deleteRequest({ ids }));
    expect(response.status).toBe(400);
    expect(updateOwnedTodoMock).not.toHaveBeenCalled();
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    requireAuthMock.mockReset();
    deleteOwnedTodoMock.mockReset();
  });

  it("在解析 JSON 请求体之前先认证", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());

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

    const response = await deleteTodoBatchRoute(deleteRequest({ ids: [] }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });

  it("拒绝包含空字符串 id 的 payload", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });

    const response = await deleteTodoBatchRoute(
      deleteRequest({ ids: ["todo-1", ""] }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid batch payload");
    expect(deleteOwnedTodoMock).not.toHaveBeenCalled();
  });
});
