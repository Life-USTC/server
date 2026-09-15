import { describe, expect, it } from "vitest";
import { sortTodosByDueDistance } from "@/features/workspace/lib/todo-list-state";

const reference = new Date("2026-09-10T12:00:00+08:00");

describe("todo deadline ordering", () => {
  it("puts undated todos first, then nearby past and future deadlines without mutating input", () => {
    const todos = [
      { id: "old", dueAt: "2026-03-26T20:00:00+08:00" },
      { id: "undated", dueAt: null },
      { id: "tomorrow", dueAt: "2026-09-11T12:00:00+08:00" },
      { id: "yesterday", dueAt: "2026-09-09T12:00:00+08:00" },
      { id: "now", dueAt: "2026-09-10T04:00:00Z" },
    ];
    const original = [...todos];
    expect(
      sortTodosByDueDistance(todos, reference).map((todo) => todo.id),
    ).toEqual(["undated", "now", "yesterday", "tomorrow", "old"]);
    expect(todos).toEqual(original);
    expect(sortTodosByDueDistance([], reference)).toEqual([]);
  });
});
