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

  return new Request("https://life.example/workspace/todos?/createTodo", {
    body,
    method: "POST",
  });
}

describe("dashboard 待办表单", () => {
  it("缺失优先级时默认使用待办功能默认值", async () => {
    const parsed = await readTodoForm(todoRequest({}), copy);

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.todo.priority).toBe("medium");
  });

  it("拒绝无效优先级而非静默转换", async () => {
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

  it("使用待办功能解析器拒绝不存在的截止日期", async () => {
    const body = new FormData();
    body.set("title", "Read Chapter 1");
    body.set("dueAt", "2026-02-30T10:00");

    const parsed = await readTodoForm(
      new Request("https://life.example/workspace/todos?/createTodo", {
        body,
        method: "POST",
      }),
      copy,
    );

    expect("error" in parsed).toBe(true);
    if (!("error" in parsed)) return;
    const { error } = parsed;
    if (!error) throw new Error("Expected invalid due date failure");
    expect(error.status).toBe(400);
    expect(error.data).toEqual({ error: "invalid due date" });
  });
});
