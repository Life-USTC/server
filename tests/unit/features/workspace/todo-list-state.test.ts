import { describe, expect, it } from "vitest";
import { sortTodosByDeadline } from "@/features/workspace/lib/todo-list-state";

describe("todo deadline ordering", () => {
  it("puts earliest deadlines first and undated tasks last without mutating input", () => {
    const todos = [
      { id: "old", dueAt: "2026-03-26T20:00:00+08:00" },
      { id: "undated", dueAt: null },
      { id: "tomorrow", dueAt: "2026-09-11T12:00:00+08:00" },
      { id: "yesterday", dueAt: "2026-09-09T12:00:00+08:00" },
      { id: "now", dueAt: "2026-09-10T04:00:00Z" },
    ];
    const original = [...todos];
    expect(sortTodosByDeadline(todos).map((todo) => todo.id)).toEqual([
      "old",
      "yesterday",
      "now",
      "tomorrow",
      "undated",
    ]);
    expect(todos).toEqual(original);
    expect(sortTodosByDeadline([])).toEqual([]);
  });
});
