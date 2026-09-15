import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { listUserCalendarEvents } from "./calendar-events";

export class InvalidCalendarRangeError extends Error {}

export async function listPersonalCalendarPage(
  userId: string,
  input: PaginationInput & {
    dateFrom?: string;
    dateTo?: string;
    locale?: string;
  } = {},
) {
  const dateFrom = input.dateFrom ? parseDateInput(input.dateFrom) : null;
  const dateTo = input.dateTo ? parseDateInput(input.dateTo) : null;
  if (Boolean(input.dateFrom) !== Boolean(input.dateTo))
    throw new InvalidCalendarRangeError("Supply both dateFrom and dateTo");
  if (
    (input.dateFrom && !dateFrom) ||
    (input.dateTo && !dateTo) ||
    (dateFrom &&
      dateTo &&
      (dateTo < dateFrom ||
        dateTo.getTime() - dateFrom.getTime() > 366 * 86400000))
  )
    throw new InvalidCalendarRangeError(
      "Calendar range must be valid, ordered and at most 366 days",
    );
  const events = await listUserCalendarEvents(userId, {
    dateFrom,
    dateTo,
    dateFromIsDateOnly: /^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom ?? ""),
    dateToIsDateOnly: /^\d{4}-\d{2}-\d{2}$/.test(input.dateTo ?? ""),
    dateToInclusive: true,
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
  });
  const { page, pageSize, skip } = normalizePagination(input);
  return buildPaginatedResponse(
    items.slice(skip, skip + pageSize),
    page,
    pageSize,
    items.length,
  );
}
