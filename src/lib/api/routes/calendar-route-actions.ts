import { handleRouteError, notFound } from "@/lib/api/helpers";
import {
  createMultiSectionCalendar,
  createSectionCalendar,
  createUserCalendar,
} from "@/lib/ical";
import {
  getIncompleteHomeworkCalendarItems,
  getSectionForCalendar,
  getSectionsForCalendar,
} from "./calendar-route-data";
import { calendarResponse } from "./calendar-route-utils";
import {
  hasUserCalendarItems,
  userCalendarTodoItems,
} from "./calendar-user-items";

export async function generateSectionsCalendarAction(sectionIds: number[]) {
  const sections = await getSectionsForCalendar(sectionIds);

  if (sections.length === 0) {
    return handleRouteError("No sections found", new Error("No sections"), 404);
  }

  const calendar = await createMultiSectionCalendar(sections);

  return calendarResponse(
    calendar.toString(),
    "life-ustc-schedule.ics",
    "public, max-age=3600",
  );
}

export async function generateSectionCalendarAction(sectionJwId: number) {
  const section = await getSectionForCalendar(sectionJwId);

  if (!section) {
    return notFound("Section not found");
  }

  const calendar = await createSectionCalendar(section);

  return calendarResponse(
    calendar.toString(),
    `life-ustc-${section.semesterId}-${section.code}.ics`,
    "public, max-age=3600",
  );
}

export async function generateUserCalendarAction(
  user: {
    subscribedSections: Array<{ id: number; [key: string]: unknown }>;
    todos: Array<{
      content?: string | null;
      dueAt?: Date | null;
      id: string;
      priority: string;
      title: string;
    }>;
  },
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
    return notFound("No calendar items found");
  }

  const calendar = await createUserCalendar({
    sections: user.subscribedSections as Parameters<
      typeof createUserCalendar
    >[0]["sections"],
    homeworks,
    todos: todos as Parameters<typeof createUserCalendar>[0]["todos"],
  });

  return calendarResponse(
    calendar.toString(),
    "life-ustc-subscriptions.ics",
    "private, max-age=300",
  );
}
