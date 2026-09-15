import { createUserCalendar } from "@/features/calendar/server/ical";
import type { CalendarTodo } from "@/features/calendar/server/ical-event-builders";
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

export async function buildUserCalendarExport(
  user: UserCalendarRecord,
  userId: string,
) {
  const subscribedSections = user.sectionSubscriptions.map(
    ({ section, kind }) => ({
      ...section,
      course: {
        ...section.course,
        nameCn:
          kind === "teaching_assistant"
            ? `[TA] ${section.course.nameCn}`
            : section.course.nameCn,
      },
    }),
  );
  const taSectionIds = new Set(
    user.sectionSubscriptions
      .filter((row) => row.kind === "teaching_assistant")
      .map((row) => row.sectionId),
  );
  const sectionIds = subscribedSections.map((section) => section.id);
  const homeworks = await getIncompleteHomeworkCalendarItems(
    userId,
    sectionIds,
  );
  const todos = userCalendarTodoItems(user.todos);

  const calendar = await createUserCalendar({
    sections: subscribedSections,
    homeworks: homeworks.map((homework) =>
      taSectionIds.has(homework.sectionId)
        ? {
            ...homework,
            section: {
              ...homework.section,
              course: {
                ...homework.section.course,
                nameCn: `[TA] ${homework.section.course.nameCn}`,
              },
            },
          }
        : homework,
    ),
    todos,
    youngEvents: user.youngEventSubscriptions.map(({ event }) => event),
  });

  return {
    cacheControl: "private, max-age=1800",
    filename: "life-ustc-subscriptions.ics",
    text: calendar.toString(),
  };
}
