import { describe, expect, it } from "vitest";
import { readTodoForm } from "@/features/dashboard/server/dashboard-todo-form";

const copy = {
  errorContentTooLong: "content too long",
  errorInvalidDueAt: "invalid due date",
  errorInvalidPriority: "invalid priority",
  errorTitleRequired: "title required",
  errorTitleTooLong: "title too long",
};

function todoRequest(input: { priority?: string; title?: string }) {
  const body = new FormData();
  body.set("title", input.title ?? "Read Chapter 1");
  if (input.priority !== undefined) {
    body.set("priority", input.priority);
  }

  return new Request("https://life.example/dashboard/todos?/createTodo", {
    body,
    method: "POST",
  });
}

describe("dashboard todo form", () => {
  it("defaults missing priority to the todo feature default", async () => {
    const parsed = await readTodoForm(todoRequest({}), copy);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.todo.priority).toBe("medium");
  });

  it("rejects invalid priority instead of silently coercing it", async () => {
    const parsed = await readTodoForm(
      todoRequest({ priority: "urgent" }),
      copy,
    );

    expect("error" in parsed).toBe(true);
    if (!("error" in parsed)) return;
    const { error } = parsed;
    if (!error) throw new Error("Expected invalid priority failure");
    expect(error.status).toBe(400);
    expect(error.data).toEqual({ error: "invalid priority" });
  });
});
