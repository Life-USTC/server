import { overviewUpcomingExams } from "@/features/workspace/lib/calendar-display";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  buildExams,
  buildSessions,
  getSemesterWeeks,
  sortSessionsByStart,
} from "./workspace-helpers";
import type { CalendarTodoItem } from "./workspace-overview-types";
import type { HomeworkWithSection } from "./workspace-types";

type GridSemesterRow = {
  id: number;
  nameCn: string | null;
  startDate: Date | null;
  endDate: Date | null;
} | null;

export function resolveGridSemesterBounds(gridSemesterRow: GridSemesterRow) {
  const semesterStart =
    gridSemesterRow?.startDate != null
      ? shanghaiDayjs(gridSemesterRow.startDate).startOf("day")
      : null;
  const semesterEnd =
    gridSemesterRow?.endDate != null
      ? shanghaiDayjs(gridSemesterRow.endDate).endOf("day")
      : null;

  return { semesterEnd, semesterStart };
}

export function buildSemesterCalendarPayload({
  calendarHomeworks,
  gridSemesterRow,
  sectionsForCalendarGrid,
  semesterTodos,
}: {
  calendarHomeworks: HomeworkWithSection[];
  gridSemesterRow: GridSemesterRow;
  sectionsForCalendarGrid: Parameters<typeof buildSessions>[0];
  semesterTodos: CalendarTodoItem[];
}) {
  const { semesterEnd, semesterStart } =
    resolveGridSemesterBounds(gridSemesterRow);
  const semesterWeeks =
    semesterStart && semesterEnd && !semesterStart.isAfter(semesterEnd)
      ? getSemesterWeeks(semesterStart, semesterEnd)
      : [];
  const allSessions = sortSessionsByStart(
    buildSessions(sectionsForCalendarGrid),
  );
  const allExams = buildExams(sectionsForCalendarGrid);
  const semesterHomeworks =
    semesterStart && semesterEnd
      ? calendarHomeworks.filter((homework) => {
          if (!homework.submissionDueAt) return false;
          const due = shanghaiDayjs(homework.submissionDueAt);
          return (
            !due.isBefore(semesterStart, "day") &&
            !due.isAfter(semesterEnd, "day")
          );
        })
      : [];

  return {
    allExams,
    allSessions,
    semesterEnd,
    semesterHomeworks,
    semesterStart,
    semesterTodos,
    semesterWeeks,
  };
}

export function buildPreviewCalendarPayload({
  calendarHomeworks,
  referenceNow,
  sections,
  todos,
  windowEnd,
  windowStart,
}: {
  calendarHomeworks: HomeworkWithSection[];
  referenceNow: ReturnType<typeof shanghaiDayjs>;
  sections: Parameters<typeof buildSessions>[0];
  todos: CalendarTodoItem[];
  windowEnd: ReturnType<typeof shanghaiDayjs>;
  windowStart: ReturnType<typeof shanghaiDayjs>;
}) {
  const inWindow = (value: Date | string) => {
    const date = shanghaiDayjs(value);
    return (
      !date.isBefore(windowStart, "day") && !date.isAfter(windowEnd, "day")
    );
  };
  const allExams = overviewUpcomingExams(
    { allExams: buildExams(sections) },
    referenceNow.toDate(),
  ).slice(0, WORKSPACE_OVERVIEW_PREVIEW_LIMIT + 1);

  return {
    allExams,
    allSessions: sortSessionsByStart(buildSessions(sections)),
    semesterEnd: null,
    semesterHomeworks: calendarHomeworks.filter(
      (homework) =>
        homework.submissionDueAt && inWindow(homework.submissionDueAt),
    ),
    semesterStart: null,
    semesterTodos: todos.filter((todo) => inWindow(todo.dueAt)),
    semesterWeeks: [],
  };
}
