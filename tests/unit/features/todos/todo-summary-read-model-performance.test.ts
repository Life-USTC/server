import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, snapshot } = vi.hoisted(() => {
  const query = vi.fn();
  return {
    query,
    snapshot: vi.fn(async (_database, _limits, action) => action({ query })),
  };
});
vi.mock("@/lib/db/runtime-database-snapshot", () => ({
  withRuntimeDatabaseSnapshot: snapshot,
}));
vi.mock("@/lib/db/prisma", () => ({ withUserDbContext: vi.fn() }));

describe("todo summary read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("AS incomplete")
        ? [{ completed: 3, incomplete: 5, overdue: 2 }]
        : sql.includes("ORDER BY")
          ? [{ id: "todo-1" }]
          : [],
    }));
  });

  it("reads counts and a bounded list with transaction-local identity and deadlines", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );
    const now = new Date("2026-08-14T08:00:00.000Z");
    const dueAfter = new Date("2026-08-01T00:00:00.000Z");
    const result = await listTodoSummary({
      filters: { completed: false, dueAfter, priority: "high" },
      now,
      userId: " user-1 ",
    });
    expect(result).toEqual({
      counts: { completed: 3, incomplete: 5, overdue: 2 },
      todos: [{ id: "todo-1" }],
    });
    expect(snapshot).toHaveBeenCalledExactlyOnceWith(
      "app",
      { maxWaitMs: 2000, timeoutMs: 5000 },
      expect.any(Function),
    );
    expect(query.mock.calls[0]).toEqual([
      "SELECT set_config('app.user_id', $1, true), set_config('statement_timeout', '5000', true)",
      ["user-1"],
    ]);
    expect(query.mock.calls[1][1]).toEqual(["user-1", now.toISOString()]);
    expect(query.mock.calls[2][1]).toEqual([
      "user-1",
      false,
      "high",
      dueAfter.toISOString(),
      null,
      100,
    ]);
  });

  it("preserves an explicit smaller list limit", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );
    await listTodoSummary({ take: 25, userId: "user-1" });
    expect(query.mock.calls[2][1]).toEqual([
      "user-1",
      null,
      null,
      null,
      null,
      25,
    ]);
  });

  it("reads counts without fetching list rows when the limit is zero", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );
    expect(
      (await listTodoSummary({ take: 0, userId: "user-1" })).todos,
    ).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty identity before acquiring a connection", async () => {
    const { listTodoSummary } = await import(
      "@/features/todos/server/todo-service"
    );
    await expect(listTodoSummary({ userId: " " })).rejects.toThrow(
      "explicit user ID",
    );
    expect(snapshot).not.toHaveBeenCalled();
  });
});
