import type dayjs from "dayjs";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getDefaultWeekStart } from "@/shared/lib/date-utils";
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
  let weekStart = getDefaultWeekStart(semesterStart);
  const lastWeekStart = getDefaultWeekStart(semesterEnd);

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
