import { withRuntimeDatabaseSnapshot } from "@/lib/db/runtime-database-snapshot";
import type { TodoListFilters, TodoSnapshot } from "./todo-service";

/** A live RLS snapshot without initializing the ORM for this fixed read. */
export function loadTodoSummary(input: {
  filters?: TodoListFilters;
  now: Date;
  take: number;
  userId: string;
}) {
  return withRuntimeDatabaseSnapshot(
    "app",
    { maxWaitMs: 2_000, timeoutMs: 5_000 },
    async (connection) => {
      await connection.query(
        "SELECT set_config('app.user_id', $1, true), set_config('statement_timeout', '5000', true)",
        [input.userId],
      );
      const {
        rows: [counts],
      } = await connection.query<{
        incomplete: number;
        completed: number;
        overdue: number;
      }>(
        `SELECT count(*) FILTER (WHERE NOT completed)::int AS incomplete,
                count(*) FILTER (WHERE completed)::int AS completed,
                count(*) FILTER (WHERE NOT completed AND "dueAt" < $2::timestamp)::int AS overdue
         FROM "Todo" WHERE "userId" = $1`,
        [input.userId, input.now.toISOString()],
      );
      const { filters } = input;
      const todos =
        input.take === 0
          ? []
          : (
              await connection.query<TodoSnapshot>(
                `SELECT id, title, content, priority, completed,
                "dueAt" AT TIME ZONE 'UTC' AS "dueAt",
                "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
                "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt"
         FROM "Todo"
         WHERE "userId" = $1
           AND ($2::boolean IS NULL OR completed = $2)
           AND ($3::"TodoPriority" IS NULL OR priority = $3)
           AND ($4::timestamp IS NULL OR "dueAt" >= $4)
           AND ($5::timestamp IS NULL OR "dueAt" < $5)
         ORDER BY completed ASC, "dueAt" ASC, "createdAt" DESC, id ASC
         LIMIT $6`,
                [
                  input.userId,
                  filters?.completed ?? null,
                  filters?.priority ?? null,
                  filters?.dueAfter?.toISOString() ?? null,
                  filters?.dueBefore?.toISOString() ?? null,
                  input.take,
                ],
              )
            ).rows;
      return { counts, todos };
    },
  );
}
