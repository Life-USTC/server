import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { type buildSessions, filterSessionsByDay } from "./dashboard-helpers";
import type { HomeworkWithSection } from "./dashboard-types";

export function buildRollingCalendarPreview({
  incompleteHomeworks,
  sessions,
  todayStart,
}: {
  incompleteHomeworks: HomeworkWithSection[];
  sessions: ReturnType<typeof buildSessions>;
  todayStart: ReturnType<typeof shanghaiDayjs>;
}) {
  const calendarStart = todayStart.subtract(3, "day");
  const calendarEnd = todayStart.add(4, "day");
  const calendarDays = Array.from({ length: 7 }, (_, index) =>
    calendarStart.add(index, "day"),
  );
  const calendarSessions = calendarDays.map((day) =>
    filterSessionsByDay(sessions, day),
  );
  const calendarHomeworks = incompleteHomeworks.filter((homework) => {
    if (!homework.submissionDueAt) return false;
    const due = shanghaiDayjs(homework.submissionDueAt);
    return !due.isBefore(calendarStart) && due.isBefore(calendarEnd);
  });

  return { calendarDays, calendarHomeworks, calendarSessions };
}
