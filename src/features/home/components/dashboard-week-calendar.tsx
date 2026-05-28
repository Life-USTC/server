import type dayjs from "dayjs";
import { getTranslations } from "next-intl/server";
import { CalendarEventCardInteractive } from "@/components/calendar-event-card-interactive";
import { CalendarDayTodoCards } from "@/features/home/components/calendar-day-todo-cards";
import {
  compactLocation,
  getSemesterWeekNumber,
  getWeekStart,
  groupByShanghaiDay,
  parseWeekParam,
  WEEKDAY_KEYS,
} from "@/features/home/components/calendar-panel-shared";
import type { OverviewData } from "@/features/home/server/dashboard-overview-data";
import type {
  ExamItem,
  SessionItem,
} from "@/features/home/server/dashboard-types";
import { Link } from "@/i18n/routing";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { cn } from "@/lib/utils";
import { formatExamTypeLabel } from "@/shared/lib/exam-utils";
import { formatTime } from "@/shared/lib/time-utils";

type WeekCalendarData = Pick<
  OverviewData,
  | "allSessions"
  | "allExams"
  | "semesterHomeworks"
  | "semesterTodos"
  | "todayStart"
  | "semesterStart"
  | "semesterEnd"
  | "referenceNow"
>;

export async function DashboardWeekCalendar({
  data,
  week,
  navHrefBase,
  weekQueryKey,
  showWeekNav = true,
}: {
  data: WeekCalendarData;
  week?: string;
  /** e.g. "/?tab=calendar&calendarView=week" or "/?tab=overview" */
  navHrefBase: string;
  weekQueryKey: "calendarWeek" | "overviewWeek";
  /** 总览等场景可隐藏「第 N 周 / 上一周 / 下一周」条 */
  showWeekNav?: boolean;
}) {
  const tSection = await getTranslations("sectionDetail");
  const tTodos = await getTranslations("todos");
  const t = showWeekNav ? await getTranslations("meDashboard") : null;

  const {
    allSessions,
    allExams,
    semesterHomeworks,
    semesterTodos,
    todayStart,
    semesterStart,
    semesterEnd,
    referenceNow,
  } = data;

  const weekdayLabels = WEEKDAY_KEYS.map((key) => tSection(`weekdays.${key}`));
  const weekLabelTemplate = tSection("weekNumber", { week: "{week}" });
  const weekStartsOn: 0 | 1 = 0;

  const sessionsByDay = groupByShanghaiDay(allSessions, (item) => item.date);
  const examsByDay = groupByShanghaiDay(allExams, (exam) => exam.date);
  const homeworksByDay = groupByShanghaiDay(
    semesterHomeworks,
    (homework) => homework.submissionDueAt,
  );
  const todosByDay = groupByShanghaiDay(semesterTodos, (todo) => todo.dueAt);

  const weekBase =
    parseWeekParam(week) ?? getWeekStart(referenceNow, weekStartsOn);
  const weekStart = getWeekStart(weekBase, weekStartsOn);
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
  const weekPrev = weekStart.subtract(7, "day");
  const weekNext = weekStart.add(7, "day");
  const weekNumber = getSemesterWeekNumber({
    semesterEnd,
    semesterStart,
    weekStart,
    weekStartsOn,
  });
  const weekLabel =
    weekNumber != null
      ? weekLabelTemplate.replace("{week}", String(weekNumber))
      : "—";

  const sep = navHrefBase.includes("?") ? "&" : "?";
  const weekLink = (d: dayjs.Dayjs) =>
    `${navHrefBase}${sep}${weekQueryKey}=${d.format("YYYY-MM-DD")}`;
  const weekNavButtonClass =
    "rounded-lg border border-border/70 bg-card/72 px-2.5 py-1.5 text-sm no-underline transition-colors hover:bg-background/90";
  const weekGridFrameClass =
    "grid grid-cols-1 gap-1 rounded-2xl border border-border/70 bg-card/50 p-1 sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";
  const weekGridHeaderCellClass =
    "hidden rounded-xl bg-background/85 px-1 py-3 text-center font-medium text-muted-foreground text-xs sm:block";
  const weekGridWeekLabelClass =
    "flex items-center justify-start rounded-xl bg-background/70 px-2 py-1.5 font-medium text-muted-foreground text-xs sm:items-start sm:justify-center sm:px-1 sm:py-2 sm:text-[0.65rem]";

  return (
    <div className="space-y-2">
      {showWeekNav && t ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={weekLink(weekPrev)} className={weekNavButtonClass}>
            {t("calendarWeek.prev")}
          </Link>
          <span className="min-w-0 shrink font-medium text-foreground text-sm">
            {weekLabel}
          </span>
          <Link href={weekLink(weekNext)} className={weekNavButtonClass}>
            {t("calendarWeek.next")}
          </Link>
        </div>
      ) : null}

      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full">
          <div className={weekGridFrameClass}>
            <div className={cn(weekGridHeaderCellClass, "rounded-t-xl")}>
              {tSection("weekLabel")}
            </div>
            {weekdayLabels.map((label) => (
              <div key={label} className={weekGridHeaderCellClass}>
                {label}
              </div>
            ))}

            <div className="contents">
              <div className={weekGridWeekLabelClass}>
                <span className="sm:[text-orientation:mixed] sm:[writing-mode:vertical-rl]">
                  {weekLabel}
                </span>
              </div>
              {weekDays.map((day) => {
                const dateKey = day.format("YYYY-MM-DD");
                const isToday = day.isSame(todayStart, "day");
                const daySessions = sessionsByDay.get(dateKey) ?? [];
                const dayExams = examsByDay.get(dateKey) ?? [];
                const dayHomeworks = homeworksByDay.get(dateKey) ?? [];
                const dayTodos = todosByDay.get(dateKey) ?? [];
                return (
                  <div
                    key={dateKey}
                    className="min-h-[5rem] min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background/95 p-1.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[7rem]"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums leading-none",
                          isToday
                            ? "bg-foreground text-background"
                            : "text-foreground",
                        )}
                      >
                        {day.format("D")}
                      </span>
                      <span className="min-w-0 truncate text-[0.65rem] text-muted-foreground">
                        <span className="sm:hidden">{day.format("ddd")}</span>
                        {day.date() === 1 ? (
                          <span className="ml-1 sm:ml-0">
                            {day.format("M 月")}
                          </span>
                        ) : null}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1 overflow-hidden">
                      {daySessions.map((item: SessionItem) => {
                        const timeLabel = `${formatTime(item.startTime)}-${formatTime(item.endTime)}`;
                        const location = compactLocation(item.location);
                        const details = [
                          { label: tSection("time"), value: timeLabel },
                          ...(location
                            ? [
                                {
                                  label: tSection("location"),
                                  value: location,
                                },
                              ]
                            : []),
                          ...(item.teacherDisplay
                            ? [
                                {
                                  label: tSection("teacher"),
                                  value: item.teacherDisplay,
                                },
                              ]
                            : []),
                        ];
                        return (
                          <CalendarEventCardInteractive
                            key={item.id}
                            href={
                              item.sectionJwId
                                ? `/sections/${item.sectionJwId}`
                                : "/?tab=subscriptions"
                            }
                            variant="session"
                            title={item.courseName}
                            time={timeLabel}
                            details={details}
                          />
                        );
                      })}
                      {dayExams.map((exam: ExamItem) => {
                        const timeLabel =
                          exam.startTime != null && exam.endTime != null
                            ? `${formatTime(exam.startTime)}-${formatTime(exam.endTime)}`
                            : "";
                        const roomLabel = exam.rooms
                          .map((r) => r.room)
                          .filter(Boolean)
                          .join("、");
                        return (
                          <CalendarEventCardInteractive
                            key={exam.id}
                            href="/?tab=exams"
                            variant="exam"
                            title={exam.courseName}
                            time={timeLabel || undefined}
                            details={[
                              ...(timeLabel
                                ? [
                                    {
                                      label: tSection("time"),
                                      value: timeLabel,
                                    },
                                  ]
                                : []),
                              ...(exam.examMode
                                ? [
                                    {
                                      label: tSection("examMode"),
                                      value: exam.examMode,
                                    },
                                  ]
                                : []),
                              ...(exam.examType != null
                                ? [
                                    {
                                      label: tSection("examType"),
                                      value: formatExamTypeLabel(
                                        exam.examType,
                                        tSection,
                                      ),
                                    },
                                  ]
                                : []),
                              ...(roomLabel
                                ? [
                                    {
                                      label: tSection("location"),
                                      value: roomLabel,
                                    },
                                  ]
                                : []),
                              ...(exam.examTakeCount != null
                                ? [
                                    {
                                      label: tSection("examCount"),
                                      value: String(exam.examTakeCount),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        );
                      })}
                      {dayHomeworks.map((hw) => {
                        const timeMeta = hw.submissionDueAt
                          ? shanghaiDayjs(hw.submissionDueAt).format("HH:mm")
                          : "";
                        const descRaw = hw.description?.content?.trim() ?? "";
                        const desc = descRaw
                          ? descRaw.replace(/\s+/g, " ").slice(0, 120)
                          : "";
                        return (
                          <CalendarEventCardInteractive
                            key={hw.id}
                            href="/?tab=homeworks"
                            variant="homework"
                            title={hw.title}
                            time={
                              timeMeta
                                ? `${tTodos("dueLabel")} ${timeMeta}`
                                : undefined
                            }
                            details={[
                              ...(timeMeta
                                ? [
                                    {
                                      label: tTodos("dueAtLabel"),
                                      value: timeMeta,
                                    },
                                  ]
                                : []),
                              ...(desc
                                ? [
                                    {
                                      label: tTodos("contentLabel"),
                                      value: desc,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        );
                      })}
                      <CalendarDayTodoCards todos={dayTodos} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
