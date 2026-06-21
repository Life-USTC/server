import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import type { TodoListFilters } from "@/features/todos/server/todo-service";
import {
  parseOptionalDateQuery,
  parsePositiveIntegerQuery,
} from "./query-value-parsing";

export function parseTodoListFilters(parsedQuery: {
  completed?: string;
  dueAfter?: string;
  dueBefore?: string;
  priority?: TodoPriorityValue;
}) {
  const dueBefore = parseOptionalDateQuery(
    "dueBefore",
    parsedQuery.dueBefore,
    "Invalid todo query",
  );
  if (dueBefore instanceof Response) return dueBefore;

  const dueAfter = parseOptionalDateQuery(
    "dueAfter",
    parsedQuery.dueAfter,
    "Invalid todo query",
  );
  if (dueAfter instanceof Response) return dueAfter;

  return {
    ...(parsedQuery.completed === "true" && { completed: true }),
    ...(parsedQuery.completed === "false" && { completed: false }),
    ...(parsedQuery.priority && { priority: parsedQuery.priority }),
    ...(dueBefore && { dueBefore }),
    ...(dueAfter && { dueAfter }),
  } satisfies TodoListFilters;
}

export function parseTodoLimit(value: string | undefined) {
  return parsePositiveIntegerQuery("limit", value, {
    max: 200,
    message: "Invalid todo query",
  });
}
