/**
 * E2E tests for PATCH /api/workspace/todos/[id] and DELETE /api/workspace/todos/[id].
 *
 * ## PATCH /api/workspace/todos/[id]
 * - Body: { title?, content?, priority?, completed?, dueAt? }
 * - Response: { success: true, todo: TodoItem }
 * - Auth required (401 if unauthenticated)
 * - Ownership check: returns 403 if todo belongs to another user
 * - Returns 404 for non-existent todo
 *
 * ## DELETE /api/workspace/todos/[id]
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Ownership check: returns 403 if todo belongs to another user
 * - Permanently deletes the todo from the database
 *
 * ## Edge cases
 * - Non-owner PATCH → 403
 * - Creates temporary todos for mutation tests (cleanup via DELETE)
 */
import { expect, type APIRequestContext, test } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";
import { signInAsDebugUserApi, signInAsDevAdminApi } from "../../_harness/auth";

async function createTodo(request: APIRequestContext, title: string) {
  const response = await request.post("/api/workspace/todos", {
    data: {
      title,
      priority: "medium",
    },
  });
  expect(response.status()).toBe(201);
  const id = ((await response.json()) as { id?: string }).id;
  expect(id).toBeTruthy();
  return id as string;
}

test("/api/workspace/todos/[id]", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/workspace/todos/[id]" });
});

test("/api/workspace/todos/[id] PATCH 未登录返回 401", async ({ request }) => {
  const response = await request.patch("/api/workspace/todos/invalid-e2e", {
    data: { title: "should fail" },
  });
  expect(response.status()).toBe(401);
});

test("/api/workspace/todos/[id] PATCH 登录后可更新待办", async ({ request }) => {
  await signInAsDebugUserApi(request, "/");
  const todoId = await createTodo(request, `e2e-api-todo-update-${Date.now()}`);

  try {
    const patchResponse = await request.patch(
      `/api/workspace/todos/${todoId}`,
      {
        data: {
          title: "updated todo title",
          completed: true,
        },
      },
    );
    expect(patchResponse.status()).toBe(200);
    const patchBody = (await patchResponse.json()) as {
      success?: boolean;
      todo?: {
        completed?: boolean;
        content?: string | null;
        createdAt?: string;
        dueAt?: string | null;
        id?: string;
        priority?: string;
        title?: string;
        updatedAt?: string;
      };
    };
    expect(patchBody).toMatchObject({
      success: true,
      todo: {
        completed: true,
        content: null,
        id: todoId,
        priority: "medium",
        title: "updated todo title",
      },
    });
    expect(patchBody.todo?.dueAt).toBeNull();
    expect(typeof patchBody.todo?.createdAt).toBe("string");
    expect(typeof patchBody.todo?.updatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(patchBody.todo?.createdAt ?? ""))).toBe(
      false,
    );
    expect(Number.isNaN(Date.parse(patchBody.todo?.updatedAt ?? ""))).toBe(
      false,
    );
  } finally {
    await request.delete(`/api/workspace/todos/${todoId}`);
  }
});

test("/api/workspace/todos/[id] PATCH 非所有者返回 403", async ({ playwright }) => {
  const debugContext = await playwright.request.newContext();
  const adminContext = await playwright.request.newContext();
  try {
    await signInAsDebugUserApi(debugContext, "/");
    const todoId = await createTodo(
      debugContext,
      `e2e-api-todo-forbidden-${Date.now()}`,
    );

    await signInAsDevAdminApi(adminContext, "/");
    const patchResponse = await adminContext.patch(
      `/api/workspace/todos/${todoId}`,
      { data: { completed: true } },
    );
    expect(patchResponse.status()).toBe(403);

    await debugContext.delete(`/api/workspace/todos/${todoId}`);
  } finally {
    await debugContext.dispose();
    await adminContext.dispose();
  }
});

test("/api/workspace/todos/[id] DELETE 未登录返回 401", async ({ request }) => {
  const response = await request.delete("/api/workspace/todos/invalid-e2e");
  expect(response.status()).toBe(401);
});

test("/api/workspace/todos/[id] DELETE 登录后可删除待办", async ({ request }) => {
  await signInAsDebugUserApi(request, "/");
  const todoId = await createTodo(request, `e2e-api-todo-delete-${Date.now()}`);

  const deleteResponse = await request.delete(
    `/api/workspace/todos/${todoId}`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toEqual({
    success: true,
  });

  const listResponse = await request.get("/api/workspace/todos");
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    todos?: Array<{ id?: string }>;
  };
  expect(listBody.todos?.some((todo) => todo.id === todoId)).toBe(false);
});
