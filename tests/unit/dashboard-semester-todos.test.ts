import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSemesterCalendarTodos } from "@/features/dashboard/server/dashboard-overview-semester-todos";
import { listDueTodoSnapshots } from "@/features/todos/server/todo-service";

vi.mock("@/features/todos/server/todo-service", () => ({
  listDueTodoSnapshots: vi.fn(),
}));

const listDueTodoSnapshotsMock = vi.mocked(listDueTodoSnapshots);

function day(value: string) {
  return {
    endOf: vi.fn(() => ({ toDate: () => new Date(`${value}T23:59:59.999Z`) })),
    toDate: () => new Date(`${value}T00:00:00.000Z`),
  };
}

describe("dashboard semester todos", () => {
  beforeEach(() => {
    listDueTodoSnapshotsMock.mockReset();
  });

  it("loads only incomplete due todos for the semester calendar", async () => {
    listDueTodoSnapshotsMock.mockResolvedValue([
      {
        completed: false,
        content: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        dueAt: new Date("2026-01-02T03:04:00.000Z"),
        id: "todo-1",
        priority: "high",
        title: "Due todo",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const todos = await listSemesterCalendarTodos({
      semesterStart: day("2026-01-01"),
      semesterEnd: day("2026-01-31"),
      userId: "user-1",
    });

    expect(listDueTodoSnapshotsMock).toHaveBeenCalledWith({
      completed: false,
      dueAtFrom: new Date("2026-01-01T00:00:00.000Z"),
      dueAtTo: new Date("2026-01-31T23:59:59.999Z"),
      includeDueAtTo: true,
      userId: "user-1",
    });
    expect(todos).toEqual([
      {
        completed: false,
        content: null,
        dueAt: "2026-01-02T11:04:00+08:00",
        id: "todo-1",
        priority: "high",
        title: "Due todo",
      },
    ]);
  });
});
