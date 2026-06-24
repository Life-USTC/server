import { createUserCalendar } from "@/lib/ical";
import type { CalendarTodo } from "@/lib/ical-event-builders";
import {
  getIncompleteHomeworkCalendarItems,
  type getUserCalendarRecord,
} from "./calendar-export-data";

type UserCalendarRecord = NonNullable<
  Awaited<ReturnType<typeof getUserCalendarRecord>>
>;

function userCalendarTodoItems(
  todos: Array<{
    content?: string | null;
    dueAt?: Date | null;
    id: string;
    priority: CalendarTodo["priority"];
    title: string;
  }>,
): CalendarTodo[] {
  return todos.flatMap((todo) =>
    todo.dueAt
      ? [
          {
            id: todo.id,
            title: todo.title,
            content: todo.content ?? null,
            dueAt: todo.dueAt,
            priority: todo.priority,
          },
        ]
      : [],
  );
}

function hasUserCalendarItems(input: {
  homeworks: unknown[];
  sections: unknown[];
  todos: unknown[];
}) {
  return (
    input.sections.length > 0 ||
    input.homeworks.length > 0 ||
    input.todos.length > 0
  );
}

export async function buildUserCalendarExport(
  user: UserCalendarRecord,
  userId: string,
) {
  const sectionIds = user.subscribedSections.map((section) => section.id);
  const homeworks = await getIncompleteHomeworkCalendarItems(
    userId,
    sectionIds,
  );
  const todos = userCalendarTodoItems(user.todos);

  if (
    !hasUserCalendarItems({
      homeworks,
      sections: user.subscribedSections,
      todos,
    })
  ) {
    return null;
  }

  const calendar = await createUserCalendar({
    sections: user.subscribedSections,
    homeworks,
    todos,
  });

  return {
    cacheControl: "private, max-age=300",
    filename: "life-ustc-subscriptions.ics",
    text: calendar.toString(),
  };
}
