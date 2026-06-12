import {
  calendarEventParts,
  calendarTimeRange,
  compactDetail,
} from "@/features/dashboard/lib/calendar";
import type {
  CalendarExamEvent,
  CalendarHomeworkEvent,
  CalendarSessionEvent,
  CalendarTodoEvent,
} from "@/features/dashboard/lib/calendar-display-types";

export function calendarHomeworkHref(
  homework: CalendarHomeworkEvent,
  fallbackHref: string,
) {
  return homework.section?.jwId
    ? `/sections/${homework.section.jwId}#homework-${homework.id}`
    : fallbackHref;
}

export function calendarExamRoomsLabel(exam: { rooms?: unknown }) {
  if (!Array.isArray(exam.rooms))
    return compactDetail(String(exam.rooms ?? ""));
  return compactDetail(
    exam.rooms
      .map((room) => {
        const item = room as { count?: number; room?: string };
        return item.count && item.count > 0
          ? `${item.room ?? ""}(${item.count})`
          : (item.room ?? "");
      })
      .join("、"),
  );
}

export function calendarSessionDetail(session: CalendarSessionEvent) {
  return calendarEventParts([
    calendarTimeRange(session.startTime, session.endTime),
    session.location,
    session.teacherDisplay,
  ]);
}

export function calendarExamDetail(exam: CalendarExamEvent) {
  return calendarEventParts([
    calendarTimeRange(exam.startTime, exam.endTime),
    exam.examMode,
    calendarExamRoomsLabel(exam),
  ]);
}

export function calendarHomeworkDetail(homework: CalendarHomeworkEvent) {
  const dueTime = homework.submissionDueAt
    ? new Date(homework.submissionDueAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return calendarEventParts([dueTime, compactDetail(homework.description)]);
}

export function calendarTodoDetail(
  todo: CalendarTodoEvent,
  priorityLabel: string,
) {
  const dueTime = todo.dueAt
    ? new Date(todo.dueAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return calendarEventParts([
    dueTime,
    priorityLabel,
    compactDetail(todo.content),
  ]);
}
