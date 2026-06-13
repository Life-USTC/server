import { prisma as basePrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import type { CalendarTodoItem } from "./dashboard-overview-types";

export async function listSemesterCalendarTodos({
  semesterEnd,
  semesterStart,
  userId,
}: {
  semesterEnd: { endOf(unit: "day"): { toDate(): Date } } | null;
  semesterStart: { toDate(): Date } | null;
  userId: string;
}): Promise<CalendarTodoItem[]> {
  const semesterTodoRows =
    semesterStart && semesterEnd
      ? await basePrisma.todo.findMany({
          where: {
            userId,
            dueAt: {
              not: null,
              gte: semesterStart.toDate(),
              lte: semesterEnd.endOf("day").toDate(),
            },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            dueAt: true,
            priority: true,
            content: true,
            completed: true,
          },
        })
      : [];

  return semesterTodoRows.flatMap((row) =>
    row.dueAt
      ? [
          {
            id: row.id,
            title: row.title,
            dueAt: toShanghaiIsoString(row.dueAt),
            priority: row.priority,
            content: row.content ?? null,
            completed: row.completed,
          },
        ]
      : [],
  );
}
