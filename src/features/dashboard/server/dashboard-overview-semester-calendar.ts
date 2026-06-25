import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  buildExams,
  buildSessions,
  getSemesterWeeks,
  sortSessionsByStart,
} from "./dashboard-helpers";
import { listSemesterCalendarTodos } from "./dashboard-overview-semester-todos";
import type { HomeworkWithSection } from "./dashboard-types";

export async function buildSemesterCalendarPayload({
  calendarHomeworks,
  gridSemesterRow,
  sectionsForCalendarGrid,
  userId,
}: {
  calendarHomeworks: HomeworkWithSection[];
  gridSemesterRow: {
    id: number;
    nameCn: string | null;
    startDate: Date | null;
    endDate: Date | null;
  } | null;
  sectionsForCalendarGrid: Parameters<typeof buildSessions>[0];
  userId: string;
}) {
  const semesterStart =
    gridSemesterRow?.startDate != null
      ? shanghaiDayjs(gridSemesterRow.startDate).startOf("day")
      : null;
  const semesterEnd =
    gridSemesterRow?.endDate != null
      ? shanghaiDayjs(gridSemesterRow.endDate).endOf("day")
      : null;
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
  const semesterTodos = await listSemesterCalendarTodos({
    semesterEnd,
    semesterStart,
    userId,
  });

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
