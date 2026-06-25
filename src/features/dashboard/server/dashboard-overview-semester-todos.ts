import { listDueTodoSnapshots } from "@/features/todos/server/todo-service";
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
      ? await listDueTodoSnapshots({
          completed: false,
          dueAtFrom: semesterStart.toDate(),
          dueAtTo: semesterEnd.endOf("day").toDate(),
          includeDueAtTo: true,
          userId,
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
