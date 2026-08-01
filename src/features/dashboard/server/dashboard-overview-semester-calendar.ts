import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  buildExams,
  buildSessions,
  getSemesterWeeks,
  sortSessionsByStart,
} from "./dashboard-helpers";
import type { CalendarTodoItem } from "./dashboard-overview-types";
import type { HomeworkWithSection } from "./dashboard-types";

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
