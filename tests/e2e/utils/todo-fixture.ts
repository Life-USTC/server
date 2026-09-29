import { expect } from "@playwright/test";
import type { Todo } from "../../../src/generated/prisma-node/client";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type TodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "content" | "completed" | "priority" | "dueAt">>;
type TodoState = {
  seed: (inputs: TodoInput[]) => Promise<Todo[]>;
  read: () => Promise<Todo[]>;
};

export const test = workerTest.extend<{
  todoActor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  todoRun: (work: () => Promise<void>) => Promise<void>;
  todoState: TodoState;
  todos: { pending: Todo; overdue: Todo; completed: Todo };
}>({
  todoActor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  // Join the complete workflow before Playwright tears down its page. The
  // Worker operation fixture separately owns setup SQL and request contexts.
  todoRun: async ({ page, todoActor, isolatedWorker, run }, use) => {
    let closing = false;
    let operation: Promise<void> | undefined;
    try {
      await use((work) => {
        if (closing || operation)
          return Promise.reject(
            new Error("Todo workflow is already owned or closing"),
          );
        operation = run(() =>
          withSettledPageWrites(
            page,
            (url) =>
              url.pathname === "/workspace/todos" ||
              url.pathname.startsWith("/api/workspace/todos/"),
            async () => {
              await page.context().addCookies([todoActor.cookie]);
              await work();
            },
            async (response, request) => {
              // Consume actual responses and inspect persisted effects before
              // releasing the browser write or disposing its private database.
              const body = await response.text();
              const db = isolatedWorker.database.owner;
              const url = new URL(request.url());
              if (url.pathname.startsWith("/api/workspace/todos/")) {
                const id = decodeURIComponent(
                  url.pathname.slice("/api/workspace/todos/".length),
                );
                expect(response.status()).toBe(200);
                const result = JSON.parse(body);
                expect(result.success).toBe(true);
                const row = await db.todo.findUnique({ where: { id } });
                if (request.method() === "DELETE") expect(row).toBeNull();
                else {
                  expect(request.method()).toBe("PATCH");
                  const { completed } = request.postDataJSON();
                  expect(typeof completed).toBe("boolean");
                  expect(result.todo).toMatchObject({ id, completed });
                  expect(row).toMatchObject({
                    id,
                    userId: todoActor.id,
                    completed,
                  });
                }
                return;
              }
              const form = await new Request(request.url(), {
                method: request.method(),
                headers: request.headers(),
                body: request.postData() ?? "",
              }).formData();
              const title = String(form.get("title") ?? "").trim();
              if (!title) {
                expect(response.status()).toBe(400);
                expect(body).toMatch(/请输入标题|Please enter a title/i);
                expect(
                  await db.todo.count({ where: { userId: todoActor.id } }),
                ).toBe(0);
                return;
              }
              expect(response.status()).toBe(200);
              expect(JSON.parse(body)).toMatchObject({
                type: "redirect",
                status: 303,
                location: "/workspace/todos",
              });
              const id = form.get("id");
              const rows = await db.todo.findMany({
                where: {
                  userId: todoActor.id,
                  ...(id ? { id: String(id) } : { title }),
                },
              });
              expect(rows).toHaveLength(1);
              expect(rows[0]).toMatchObject({
                title,
                content: String(form.get("content") ?? "").trim() || null,
                priority: String(form.get("priority")),
              });
            },
          ),
        );
        return operation;
      });
    } finally {
      closing = true;
      await operation;
    }
  },
  todoState: async ({ todoActor, isolatedWorker, run }, use) => {
    const db = isolatedWorker.database.owner;
    await use({
      seed: (inputs) =>
        run(() =>
          db.$transaction(
            inputs.map((input) =>
              db.todo.create({ data: { ...input, userId: todoActor.id } }),
            ),
          ),
        ),
      read: () =>
        run(() =>
          db.todo.findMany({
            where: { userId: todoActor.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          }),
        ),
    });
  },
  todos: async ({ todoState }, use) => {
    const [pending, overdue, completed] = await todoState.seed([
      {
        title: "Private pending todo",
        priority: "high",
        dueAt: new Date(Date.now() + 3_600_000),
      },
      {
        title: "Private overdue todo",
        priority: "medium",
        dueAt: new Date(Date.now() - 86_400_000),
      },
      { title: "Private completed todo", priority: "high", completed: true },
    ]);
    await use({ pending, overdue, completed });
  },
});
