import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import {
  calendarEventParts,
  calendarTimeRange,
  compactDetail,
} from "@/features/workspace/lib/calendar";
import type {
  CalendarExamEvent,
  CalendarHomeworkEvent,
  CalendarSessionEvent,
  CalendarTodoEvent,
} from "@/features/workspace/lib/calendar-display-types";
import { formatShanghaiTime } from "@/lib/time/shanghai-format";

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

export function calendarSessionTimelineFields(
  session: CalendarSessionEvent,
): CalendarEventChipFields {
  return {
    meta: calendarTimeRange(session.startTime, session.endTime),
    detail: calendarEventParts([
      session.sectionCode,
      session.location,
      session.teacherDisplay,
    ]),
  };
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
  noCompletionRequired?: string,
): CalendarEventChipFields {
  const dueTime = homework.submissionDueAt
    ? formatShanghaiTime(homework.submissionDueAt)
    : "";
  return {
    meta: dueTime,
    detail: calendarEventParts([
      homework.completionRequired === false ? noCompletionRequired : null,
      compactDetail(homework.description),
    ]),
  };
}

export function calendarTodoChipFields(
  todo: CalendarTodoEvent,
  priorityLabel: string,
): CalendarEventChipFields {
  const dueTime = todo.dueAt ? formatShanghaiTime(todo.dueAt) : "";
  return {
    meta: dueTime,
    detail: calendarEventParts([priorityLabel, compactDetail(todo.content)]),
  };
}
