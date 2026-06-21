/**
 * E2E tests for GET /api/todos and POST /api/todos.
 *
 * ## GET /api/todos
 * - Response: { counts: { incomplete, completed, overdue }, todos: Array<{ id, title, content, priority, completed, dueAt, ... }> }
 * - Auth required (401 if unauthenticated)
 * - Returns all todos belonging to the current user
 *
 * ## POST /api/todos
 * - Body: { title, content?, priority?, dueAt? }
 * - Response: { id: string }
 * - Auth required (401 if unauthenticated)
 * - Creates a new todo for the current user
 * - Returns 400 for missing title
 *
 * ## Edge cases
 * - Unauthenticated GET/POST → 401
 * - Seed todo appears in list with correct priority and completed status
 * - Full create → verify in list → cleanup via DELETE
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test("/api/todos", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/todos" });
});

test("/api/todos GET 未登录返回 401", async ({ request }) => {
  const response = await request.get("/api/todos");
  expect(response.status()).toBe(401);
});

test("/api/todos GET 登录后返回 seed 待办", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/todos");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    counts?: { completed?: number; incomplete?: number; overdue?: number };
    todos?: Array<{ title?: string; completed?: boolean }>;
  };
  expect(typeof body.counts?.incomplete).toBe("number");
  expect(typeof body.counts?.completed).toBe("number");
  expect(typeof body.counts?.overdue).toBe("number");
  expect(
    body.todos?.some(
      (todo) =>
        todo.title === DEV_SEED.todos.dueTodayTitle && todo.completed === false,
    ),
  ).toBe(true);
});

test("/api/todos GET supports completed filter and limit", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/todos?completed=false&limit=1");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    todos?: Array<{ completed?: boolean }>;
  };

  expect(body.todos).toHaveLength(1);
  expect(body.todos?.every((todo) => todo.completed === false)).toBe(true);
});

test("/api/todos GET rejects invalid limit", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/todos?limit=0");
  expect(response.status()).toBe(400);
});

test("todos have all required TodoItem fields", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/todos");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    todos?: Array<Record<string, unknown>>;
  };

  const todo = body.todos?.find(
    (t) => t.title === DEV_SEED.todos.dueTodayTitle,
  );
  expect(todo).toBeDefined();
  if (!todo) return;

  expect(typeof todo.id).toBe("string");
  expect(todo.id).toBeTruthy();
  expect(typeof todo.title).toBe("string");
  expect(Object.hasOwn(todo, "content")).toBe(true);
  expect(typeof todo.completed).toBe("boolean");
  expect(typeof todo.priority).toBe("string");
  expect(Object.hasOwn(todo, "dueAt")).toBe(true);
  expect(typeof todo.createdAt).toBe("string");
  expect(typeof todo.updatedAt).toBe("string");
});

test("/api/todos POST 未登录返回 401", async ({ request }) => {
  const response = await request.post("/api/todos", {
    data: { title: "should fail" },
  });
  expect(response.status()).toBe(401);
});

test("/api/todos POST 登录后可创建新待办并清理", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const title = `e2e-api-todo-${Date.now()}`;
  const createResponse = await page.request.post("/api/todos", {
    data: {
      title,
      content: "from api test",
      priority: "high",
    },
  });
  expect(createResponse.status()).toBe(200);

  const createdId = ((await createResponse.json()) as { id?: string }).id;
  expect(createdId).toBeTruthy();

  try {
    const listResponse = await page.request.get("/api/todos");
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      todos?: Array<{ id?: string; title?: string; priority?: string }>;
    };
    expect(
      listBody.todos?.some(
        (todo) =>
          todo.id === createdId &&
          todo.title === title &&
          todo.priority === "high",
      ),
    ).toBe(true);
  } finally {
    if (createdId) {
      await page.request.delete(`/api/todos/${createdId}`);
    }
  }
});
