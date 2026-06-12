import type { Prisma, TodoPriority } from "@/generated/prisma/client";
import { parseDateInput } from "@/lib/time/parse-date-input";

export function buildTodoWhere(
  userId: string,
  parsedQuery: {
    completed?: string;
    dueAfter?: string;
    dueBefore?: string;
    priority?: string;
  },
) {
  const where: Prisma.TodoWhereInput = { userId };
  if (parsedQuery.completed === "true") where.completed = true;
  else if (parsedQuery.completed === "false") where.completed = false;
  if (parsedQuery.priority)
    where.priority = parsedQuery.priority as TodoPriority;
  if (parsedQuery.dueBefore || parsedQuery.dueAfter) {
    const dueAtFilter: Prisma.TodoWhereInput["dueAt"] = {};
    if (parsedQuery.dueBefore) {
      const parsed = parseDateInput(parsedQuery.dueBefore);
      if (parsed) dueAtFilter.lt = parsed;
    }
    if (parsedQuery.dueAfter) {
      const parsed = parseDateInput(parsedQuery.dueAfter);
      if (parsed) dueAtFilter.gte = parsed;
    }
    where.dueAt = dueAtFilter;
  }
  return where;
}
