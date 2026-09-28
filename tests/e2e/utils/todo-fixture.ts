import type { Todo } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";

type TodoInput = Pick<Todo, "title"> &
  Partial<Pick<Todo, "content" | "completed" | "priority" | "dueAt">>;
type TodoState = {
  seed: (inputs: TodoInput[]) => Promise<Todo[]>;
  read: () => Promise<Todo[]>;
};

export const test = accountTest.extend<{
  todoState: TodoState;
  todos: { pending: Todo; overdue: Todo; completed: Todo };
}>({
  todoState: async ({ account }, use) => {
    await use({
      seed: (inputs) =>
        withE2ePrisma((db) =>
          db.$transaction(
            inputs.map((input) =>
              db.todo.create({ data: { ...input, userId: account.id } }),
            ),
          ),
        ),
      read: () =>
        withE2ePrisma((db) =>
          db.todo.findMany({
            where: { userId: account.id },
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
