import { calendarConflictInterval } from "@/features/calendar/lib/calendar-conflict-interval";
import {
  mapExamCalendarEvent,
  mapScheduleCalendarEvent,
} from "@/features/calendar/server/calendar-event-mappers";
import {
  isWithinExactWindow,
  resolveCalendarEventWindow,
} from "@/features/calendar/server/calendar-event-window";
import {
  homeworkCalendarItem,
  type PersonalCalendarItem,
  todoCalendarItem,
} from "@/features/calendar/server/personal-calendar-item";
import { parsePersonalCalendarRange } from "@/features/calendar/server/personal-calendar-range";
import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import { isHomeworkPendingForViewer } from "@/features/homeworks/lib/homework-completion-state";
import type { AppLocale } from "@/i18n/config";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import { toDateTimeFromHHmm } from "@/lib/time/date-time-from-hhmm";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  formatShanghaiDate,
} from "@/lib/time/shanghai-format";
import { getDemoCatalogSection } from "./demo-catalog";
import { getDemoHomeworks } from "./demo-homeworks";
import { getDemoSubscribedSections } from "./demo-subscriptions";
import { getDemoTodos } from "./demo-todos";
import { getDemoSubscribedYoungCalendarItems } from "./demo-young-workspace";

/** Reuse the existing fixed records; no recurring classes or personal events are invented. */
export function getDemoCalendarEvents(
  locale: AppLocale,
): PersonalCalendarItem[] {
  const sections = getDemoSubscribedSections(locale);
  const kinds = new Map(sections.map(({ id, kind }) => [id, kind]));
  const academic = sections.flatMap((section) => {
    const detail = getDemoCatalogSection(section.jwId, locale);
    if (!detail) throw new Error("Missing demo calendar section");
    const context = {
      youngId: null,
      sectionJwId: section.jwId,
      sectionCode: section.code,
      teachers: section.teachers.map(({ namePrimary }) => namePrimary),
      subscriptionKind: section.kind,
      priority: null,
      content: null,
      completionRequired: null,
    };
    const schedules: PersonalCalendarItem[] = detail.schedules.map(
      (schedule) => {
        const source = {
          ...schedule,
          date: schedule.date ? new Date(schedule.date) : null,
        };
        const event = mapScheduleCalendarEvent(source);
        const endsAt = event.filterEnd
          ? toShanghaiIsoString(event.filterEnd)
          : null;
        const interval = calendarConflictInterval(event.at, endsAt);
        return {
          ...context,
          id: `schedule-${schedule.id}-${event.at}`,
          type: "schedule",
          at: event.at,
          endsAt,
          title: section.course.namePrimary,
          location: schedule.customPlace,
          url: `/catalog/sections/${section.jwId}`,
          target: { kind: "section", id: String(section.jwId) },
          examMode: null,
          hasTime: schedule.startTime !== null,
          conflictIntervals: interval ? [interval] : [],
        };
      },
    );
    const exams: PersonalCalendarItem[] = detail.exams.map((exam) => {
      const source = {
        ...exam,
        examDate: exam.examDate ? new Date(exam.examDate) : null,
      };
      const event = mapExamCalendarEvent(source);
      const end = toDateTimeFromHHmm(source.examDate, source.endTime);
      const endsAt = end ? toShanghaiIsoString(end) : null;
      const interval = calendarConflictInterval(event.at, endsAt);
      return {
        ...context,
        id: `exam-${exam.id}`,
        type: "exam",
        at: event.at,
        endsAt,
        title: section.course.namePrimary,
        location: null,
        url: "/workspace/exams",
        target: { kind: "exam", id: String(exam.id) },
        examMode: exam.examMode,
        hasTime: exam.startTime !== null,
        conflictIntervals: interval ? [interval] : [],
      };
    });
    return [...schedules, ...exams];
  });
  const homeworks = getDemoHomeworks(locale)
    .filter(
      (homework) =>
        homework.submissionDueAt &&
        isHomeworkPendingForViewer(homework, new Date(DEMO_REFERENCE_NOW)),
    )
    .map((homework) =>
      homeworkCalendarItem(
        {
          ...homework,
          submissionDueAt: homework.submissionDueAt
            ? new Date(homework.submissionDueAt)
            : null,
        },
        kinds,
      ),
    );
  const todos = getDemoTodos(locale)
    .filter((todo) => !todo.completed && todo.dueAt)
    .map((todo) =>
      todoCalendarItem({
        ...todo,
        dueAt: todo.dueAt ? new Date(todo.dueAt) : null,
      }),
    );
  // Stable equal-time ordering follows the same source order as the live reader.
  return [
    ...getDemoSubscribedYoungCalendarItems(locale),
    ...academic,
    ...homeworks,
    ...todos,
  ].sort(
    (a, b) =>
      (a.at ? Date.parse(a.at) : Number.MAX_SAFE_INTEGER) -
      (b.at ? Date.parse(b.at) : Number.MAX_SAFE_INTEGER),
  );
}

export function readDemoCalendarEvents(
  locale: AppLocale,
  input: PaginationInput & { dateFrom?: string; dateTo?: string } = {},
) {
  // An omitted range is relative to the published fixture clock, never wall time.
  const range = parsePersonalCalendarRange(
    input.dateFrom === undefined && input.dateTo === undefined
      ? {
          dateFrom: DEMO_REFERENCE_NOW.slice(0, 10),
          dateTo: formatShanghaiDate(
            addShanghaiTime(new Date(DEMO_REFERENCE_NOW), 6, "day"),
          ),
        }
      : input,
  );
  const { windowStart, windowEnd, includeWindowEnd } =
    resolveCalendarEventWindow(range);
  const events = getDemoCalendarEvents(locale).filter((event) =>
    isWithinExactWindow(
      {
        start: event.at ? new Date(event.at) : null,
        end: event.endsAt ? new Date(event.endsAt) : null,
      },
      windowStart,
      windowEnd,
      includeWindowEnd,
      "overlap",
    ),
  );
  const { page, pageSize, skip } = normalizePagination(input);
  return buildPaginatedResponse(
    events.slice(skip, skip + pageSize),
    page,
    pageSize,
    events.length,
  );
}
