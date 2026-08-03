import { expect } from "vitest";

/**
 * Cross-adapter todo create/update invariants. Both REST and MCP call
 * `features/todos/server` use-cases; adapters only differ in envelope shape.
 */

export type TodoUpdateEcho = {
  id: string;
  title: string;
  priority?: string;
  completed?: boolean;
  content?: string | null;
};

export function assertTodoCreateSuccess<
  T extends { id?: string | null; success?: boolean },
>(result: T): asserts result is T & { id: string } {
  if (result.success !== undefined) {
    expect(result.success).toBe(true);
  }
  expect(typeof result.id).toBe("string");
  expect(result.id).toBeTruthy();
}

export function assertTodoUpdateEcho(
  result: {
    success?: boolean;
    todo?: Partial<TodoUpdateEcho> | null;
  },
  expected: Partial<TodoUpdateEcho> & { id: string },
) {
  if (result.success !== undefined) {
    expect(result.success).toBe(true);
  }
  expect(result.todo).not.toBeNull();
  expect(result.todo?.id).toBe(expected.id);
  if (expected.title !== undefined) {
    expect(result.todo?.title).toBe(expected.title);
  }
  if (expected.priority !== undefined) {
    expect(result.todo?.priority).toBe(expected.priority);
  }
  if (expected.completed !== undefined) {
    expect(result.todo?.completed).toBe(expected.completed);
  }
  if (expected.content !== undefined) {
    expect(result.todo?.content).toBe(expected.content);
  }
}

export function assertTodoListedWithFields(
  todos: Array<{
    id?: string;
    title?: string;
    priority?: string;
    content?: string | null;
  }>,
  expected: {
    id: string;
    title: string;
    priority?: string;
    content?: string | null;
  },
) {
  expect(
    todos.some(
      (todo) =>
        todo.id === expected.id &&
        todo.title === expected.title &&
        (expected.priority === undefined ||
          todo.priority === expected.priority) &&
        (expected.content === undefined || todo.content === expected.content),
    ),
  ).toBe(true);
}
