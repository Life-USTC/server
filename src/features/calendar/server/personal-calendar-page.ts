import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import { parsePersonalCalendarRange } from "./personal-calendar-range";

export { InvalidCalendarRangeError } from "./personal-calendar-range";

import { listUserCalendarEvents } from "./calendar-events";

export async function listPersonalCalendarPage(
  userId: string,
  input: PaginationInput & {
    dateFrom?: string;
    dateTo?: string;
    locale?: string;
  } = {},
) {
  const range = parsePersonalCalendarRange(input);
  const events = await listUserCalendarEvents(userId, {
    ...range,
    locale: input.locale,
  });
  const items = events.map((event) => {
    const base = {
      type: event.type,
      at: event.at,
      endsAt: event.endsAt,
      youngId: null as string | null,
    };
    switch (event.type) {
      case "young_event":
        return {
          ...base,
          id: `young-${event.payload.youngId}`,
          youngId: event.payload.youngId,
          title: event.payload.name,
          location: event.payload.location,
          url: `/catalog/young-events/${encodeURIComponent(event.payload.youngId)}`,
        };
      case "todo_due":
        return {
          ...base,
          id: `todo-${event.payload.id}`,
          title: event.payload.title,
          location: null,
          url: "/workspace/todos",
        };
      case "homework_due":
        return {
          ...base,
          id: `homework-${event.payload.id}`,
          title: event.payload.title,
          location: null,
          url: "/workspace/homeworks",
        };
      case "schedule":
        return {
          ...base,
          id: `schedule-${event.payload.id}-${event.at}`,
          title: event.payload.section.course.nameCn,
          location: event.payload.room?.nameCn ?? null,
          url: `/catalog/sections/${event.payload.section.jwId}`,
        };
      case "exam":
        return {
          ...base,
          id: `exam-${event.payload.id}`,
          title: event.payload.section.course.nameCn,
          location: null,
          url: "/workspace/exams",
        };
    }
    throw new Error("Unsupported calendar event type");
  });
  const { page, pageSize, skip } = normalizePagination(input);
  return buildPaginatedResponse(
    items.slice(skip, skip + pageSize),
    page,
    pageSize,
    items.length,
  );
}
