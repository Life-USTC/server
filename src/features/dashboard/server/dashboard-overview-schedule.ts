import type { AppLocale } from "@/i18n/config";
import {
  createWeekDayFormatter,
  getDefaultWeekRange,
} from "@/shared/lib/date-utils";
import {
  buildSessions,
  buildTimeSlots,
  buildWeekDays,
  computeHomeworkBuckets,
  filterSessionsByDay,
  selectWeeklySessions,
  sortSessionsByStart,
} from "./dashboard-helpers";
import { buildRollingCalendarPreview } from "./dashboard-overview-calendar";

export function buildDashboardOverviewSchedule({
  dashboardSections,
  homeworks,
  locale,
  referenceNow,
}: {
  dashboardSections: Parameters<typeof buildSessions>[0];
  homeworks: Parameters<typeof computeHomeworkBuckets>[0];
  locale: AppLocale;
  referenceNow: ReturnType<typeof getDefaultWeekRange>["start"];
}) {
  const sessions = sortSessionsByStart(buildSessions(dashboardSections));
  const todayStart = referenceNow.startOf("day");
  const tomorrowStart = todayStart.add(1, "day");
  const { start: weekStart, endExclusive: weekEnd } =
    getDefaultWeekRange(referenceNow);
  const todaySessions = filterSessionsByDay(sessions, todayStart);
  const tomorrowSessions = filterSessionsByDay(sessions, tomorrowStart);
  const weeklySessions = selectWeeklySessions(sessions, weekStart, weekEnd);
  const weekDays = buildWeekDays(weekStart);
  const timeSlots = buildTimeSlots(weeklySessions);
  const { incompleteHomeworks, dueToday, dueWithin3Days } =
    computeHomeworkBuckets(homeworks, todayStart);
  const weekDayFormatter = createWeekDayFormatter(locale);
  const { calendarDays, calendarHomeworks, calendarSessions } =
    buildRollingCalendarPreview({
      incompleteHomeworks,
      sessions,
      todayStart,
    });

  return {
    todaySessions,
    tomorrowSessions,
    weeklySessions,
    weekDays,
    timeSlots,
    incompleteHomeworks,
    dueToday,
    dueWithin3Days,
    calendarSessions,
    calendarHomeworks,
    calendarDays,
    weekDayFormatter,
    todayStart,
  };
}
