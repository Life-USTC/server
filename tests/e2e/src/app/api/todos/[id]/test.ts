/**
 * E2E tests for PATCH /api/todos/[id] and DELETE /api/todos/[id].
 *
 * ## PATCH /api/todos/[id]
 * - Body: { title?, content?, priority?, completed?, dueAt? }
 * - Response: { success: true, todo: TodoItem }
 * - Auth required (401 if unauthenticated)
 * - Ownership check: returns 403 if todo belongs to another user
 * - Returns 404 for non-existent todo
 *
 * ## DELETE /api/todos/[id]
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Ownership check: returns 403 if todo belongs to another user
 * - Permanently deletes the todo from the database
 *
 * ## Edge cases
 * - Non-owner PATCH → 403
 * - Creates temporary todos for mutation tests (cleanup via DELETE)
 */
import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { assertApiContract } from "../../../_shared/api-contract";

async function createTodo(page: Page, title: string) {
  const response = await page.request.post("/api/todos", {
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

test("/api/todos/[id]", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/todos/[id]" });
});

test("/api/todos/[id] PATCH 未登录返回 401", async ({ request }) => {
  const response = await request.patch("/api/todos/invalid-e2e", {
    data: { title: "should fail" },
  });
  expect(response.status()).toBe(401);
});

test("/api/todos/[id] PATCH 登录后可更新待办", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const todoId = await createTodo(page, `e2e-api-todo-update-${Date.now()}`);

  try {
    const patchResponse = await page.request.patch(`/api/todos/${todoId}`, {
      data: {
        title: "updated todo title",
        completed: true,
      },
    });
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
    await page.request.delete(`/api/todos/${todoId}`);
  }
});

test("/api/todos/[id] PATCH 非所有者返回 403", async ({ browser }) => {
  const debugContext = await browser.newContext();
  const debugPage = await debugContext.newPage();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  try {
    await signInAsDebugUser(debugPage, "/");
    const todoId = await createTodo(
      debugPage,
      `e2e-api-todo-forbidden-${Date.now()}`,
    );

    await signInAsDevAdmin(adminPage, "/");
    const patchResponse = await adminPage.request.patch(
      `/api/todos/${todoId}`,
      { data: { completed: true } },
    );
    expect(patchResponse.status()).toBe(403);

    await debugPage.request.delete(`/api/todos/${todoId}`);
  } finally {
    await debugContext.close();
    await adminContext.close();
  }
});

test("/api/todos/[id] DELETE 未登录返回 401", async ({ request }) => {
  const response = await request.delete("/api/todos/invalid-e2e");
  expect(response.status()).toBe(401);
});

test("/api/todos/[id] DELETE 登录后可删除待办", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const todoId = await createTodo(page, `e2e-api-todo-delete-${Date.now()}`);

  const deleteResponse = await page.request.delete(`/api/todos/${todoId}`);
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toEqual({
    success: true,
  });

  const listResponse = await page.request.get("/api/todos");
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    todos?: Array<{ id?: string }>;
  };
  expect(listBody.todos?.some((todo) => todo.id === todoId)).toBe(false);
});
