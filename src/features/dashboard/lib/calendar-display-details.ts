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
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";

export function calendarHomeworkHref(
  homework: CalendarHomeworkEvent,
  fallbackHref: string,
) {
  return homework.section?.jwId
    ? sectionDetailHomeworkPath(homework.section.jwId, {
        homeworkId: homework.id,
      })
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

export type CalendarEventChipFields = {
  detail: string;
  meta: string;
  /** Full third-line (and extras) for hover; defaults to detail when omitted. */
  tooltipDetail?: string;
};

/** First location segment — room / custom place (e.g. 一教101). */
export function calendarClassroomLabel(
  location: string | null | undefined,
): string {
  const text = String(location ?? "").trim();
  if (!text || text === "—") return "";
  return text.split(" · ")[0]?.trim() ?? text;
}

export function calendarSessionChipFields(
  session: CalendarSessionEvent,
): CalendarEventChipFields {
  const classroom = calendarClassroomLabel(session.location);
  const fullDetail = calendarEventParts([
    session.location,
    session.teacherDisplay,
  ]);
  return {
    meta: calendarTimeRange(session.startTime, session.endTime),
    detail: classroom,
    tooltipDetail: fullDetail || undefined,
  };
}

export function calendarSessionDetail(session: CalendarSessionEvent) {
  return calendarEventParts([
    calendarTimeRange(session.startTime, session.endTime),
    session.location,
    session.teacherDisplay,
  ]);
}

export function calendarExamChipFields(
  exam: CalendarExamEvent,
): CalendarEventChipFields {
  return {
    meta: calendarTimeRange(exam.startTime, exam.endTime),
    detail: calendarEventParts([exam.examMode, calendarExamRoomsLabel(exam)]),
  };
}

export function calendarExamDetail(exam: CalendarExamEvent) {
  const { meta, detail } = calendarExamChipFields(exam);
  return calendarEventParts([meta, detail]);
}

export function calendarHomeworkChipFields(
  homework: CalendarHomeworkEvent,
): CalendarEventChipFields {
  const dueTime = homework.submissionDueAt
    ? new Date(homework.submissionDueAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return {
    meta: dueTime,
    detail: compactDetail(homework.description),
  };
}

export function calendarHomeworkDetail(homework: CalendarHomeworkEvent) {
  const { meta, detail } = calendarHomeworkChipFields(homework);
  return calendarEventParts([meta, detail]);
}

export function calendarTodoChipFields(
  todo: CalendarTodoEvent,
  priorityLabel: string,
): CalendarEventChipFields {
  const dueTime = todo.dueAt
    ? new Date(todo.dueAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return {
    meta: dueTime,
    detail: calendarEventParts([priorityLabel, compactDetail(todo.content)]),
  };
}

export function calendarTodoDetail(
  todo: CalendarTodoEvent,
  priorityLabel: string,
) {
  const { meta, detail } = calendarTodoChipFields(todo, priorityLabel);
  return calendarEventParts([meta, detail]);
}
