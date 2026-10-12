import { expect, type Page, type Response } from "@playwright/test";
import type { Todo } from "../../../src/generated/prisma-node/client";
import { withBrowserWorkflow } from "./browser-workflow";
import { type HomeworkEffects, withHomeworkEffects } from "./homework-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

type TodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "content" | "completed" | "priority" | "dueAt">>;
type TodoState = {
  seed: (inputs: TodoInput[]) => Promise<Todo[]>;
  read: () => Promise<Todo[]>;
};

export const test = workerTest.extend<{
  todoActor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  todoRun: (
    work: Parameters<typeof withHomeworkEffects>[1],
    effects: HomeworkEffects,
  ) => Promise<void>;
  todoState: TodoState;
  todos: { pending: Todo; overdue: Todo; completed: Todo };
}>({
  todoActor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  // The existing effect owner joins the complete callback before its final
  // producer/calendar snapshot, including after runner interruption.
  todoRun: async ({ page, todoActor, isolatedWorker, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, effects) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: todoActor,
                runBody: workflow.body,
                ...effects,
                observeReads: true,
              },
              async (effects) => {
                await page.context().addCookies([todoActor.cookie]);
                await work(effects);
              },
            ),
          ),
        ),
      );
    });
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

// Svelte's enhanced form transports its redirect as an HTTP 200 action result.
// This observes the real response; expected Todo data belongs to each scenario.
export async function expectTodoFormResponse(response: Response) {
  expect(response.request().method()).toBe("POST");
  expect(new URL(response.url()).pathname).toBe("/workspace/todos");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    type: "redirect",
    status: 303,
    location: "/workspace/todos",
  });
}

// Read only the export already written by the registered native consumer.
// Call after effects.checkpoint; this does not rebuild a calendar on demand.
export async function readTodoCalendar(page: Page, userId: string) {
  const response = await page.request.get(
    `/__test/calendar-consumer?userId=${userId}`,
    { headers: { "x-test-storage-secret": "local-test-storage-observer" } },
  );
  expect(response.status()).toBe(200);
  const observed: { calendar: string | null } = await response.json();
  expect(observed.calendar).not.toBeNull();
  if (!observed.calendar) throw new Error("Native todo consumer has no export");
  const calendar: { version: number; text: string } = JSON.parse(
    observed.calendar,
  );
  expect(calendar).toMatchObject({ version: 2, text: expect.any(String) });
  // Unfold ICS content lines before matching UUIDs split at the byte limit.
  return calendar.text.replace(/\r?\n[ \t]/g, "");
}
