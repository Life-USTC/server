import type dayjs from "dayjs";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getWeekStart, SUNDAY_WEEK_STARTS_ON } from "@/shared/lib/date-utils";
import type { SessionItem } from "./dashboard-types";

export const filterSessionsByDay = (
  sessions: SessionItem[],
  targetDay: dayjs.Dayjs,
) =>
  sessions.filter((item) => shanghaiDayjs(item.date).isSame(targetDay, "day"));

/** Returns weeks (Mon-Sun) from semester start to end, inclusive. */
export const getSemesterWeeks = (
  semesterStart: dayjs.Dayjs,
  semesterEnd: dayjs.Dayjs,
): dayjs.Dayjs[][] => {
  const weeks: dayjs.Dayjs[][] = [];
  let weekStart = getWeekStart(semesterStart, SUNDAY_WEEK_STARTS_ON);
  const lastWeekStart = getWeekStart(semesterEnd, SUNDAY_WEEK_STARTS_ON);

  while (
    weekStart.isBefore(lastWeekStart, "day") ||
    weekStart.isSame(lastWeekStart, "day")
  ) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) =>
        weekStart.add(i, "day").startOf("day"),
      ),
    );
    weekStart = weekStart.add(7, "day");
  }

  return weeks;
};

export const selectWeeklySessions = (
  sessions: SessionItem[],
  weekStart: dayjs.Dayjs,
  weekEnd: dayjs.Dayjs,
) =>
  sessions.filter((item) => {
    const date = shanghaiDayjs(item.date);
    return !date.isBefore(weekStart) && date.isBefore(weekEnd);
  });
