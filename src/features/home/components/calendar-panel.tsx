import type dayjs from "dayjs";
import { getTranslations } from "next-intl/server";
import { CalendarEventCardInteractive } from "@/components/calendar-event-card-interactive";
import { CopyCalendarLinkButton } from "@/components/copy-calendar-link-button";
import {
  DashboardTabToolbar,
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { CalendarDayTodoCards } from "@/features/home/components/calendar-day-todo-cards";
import { DashboardWeekCalendar } from "@/features/home/components/dashboard-week-calendar";
import type {
  CalendarTodoItem,
  OverviewData,
} from "@/features/home/server/dashboard-overview-data";
import type {
  ExamItem,
  SessionItem,
} from "@/features/home/server/dashboard-types";
import { Link } from "@/i18n/routing";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { cn } from "@/lib/utils";
import { formatExamTypeLabel } from "@/shared/lib/exam-utils";
import { formatTime } from "@/shared/lib/time-utils";

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type CalendarView = "semester" | "month" | "week";

function parseCalendarView(view: string | undefined): CalendarView {
  if (view === "month" || view === "week" || view === "semester") return view;
  return "semester";
}

function compactLocation(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  // UI：卡片里只展示最核心的地点（例如教室），不拼接教学楼/校区等额外信息
  const first = value.split(" · ")[0]?.trim();
  return first || undefined;
}

function parseMonthParam(raw: string | undefined): dayjs.Dayjs | null {
  if (!raw) return null;
  const m = shanghaiDayjs(`${raw}-01`);
  if (!m.isValid()) return null;
  return m.startOf("month");
}

function parseWeekParam(raw: string | undefined): dayjs.Dayjs | null {
  if (!raw) return null;
  const d = shanghaiDayjs(raw);
  if (!d.isValid()) return null;
  return d.startOf("day");
}

function getWeekStart(date: dayjs.Dayjs, weekStartsOn: 0 | 1) {
  let start = date.startOf("day");
  while (start.day() !== weekStartsOn) {
    start = start.subtract(1, "day");
  }
  return start;
}

export async function CalendarPanel({
  data,
  calendarSubscriptionUrl,
  view,
  month,
  week,
}: {
  data: OverviewData;
  calendarSubscriptionUrl: string | null;
  view?: string;
  month?: string;
  week?: string;
}) {
  const t = await getTranslations("meDashboard");
  const tSection = await getTranslations("sectionDetail");
  const tSubscriptions = await getTranslations("subscriptions");
  const tTodos = await getTranslations("todos");
  const weekdayLabels = WEEKDAY_KEYS.map((key) => tSection(`weekdays.${key}`));
  const weekLabelTemplate = tSection("weekNumber", { week: "{week}" });

  const {
    semesterWeeks,
    allSessions,
    allExams,
    semesterHomeworks,
    semesterTodos,
    todayStart,
    semesterStart,
    semesterEnd,
    referenceNow,
    calendarSemesterNavList,
    activeCalendarSemesterId,
    defaultCalendarSemesterId,
    activeCalendarSemesterName,
  } = data;

  if (semesterWeeks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("today.empty")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const currentView = parseCalendarView(view);
  const calendarSemesterSuffix =
    activeCalendarSemesterId != null &&
    (defaultCalendarSemesterId == null ||
      activeCalendarSemesterId !== defaultCalendarSemesterId)
      ? `&calendarSemester=${activeCalendarSemesterId}`
      : "";
  const baseHref = `/?tab=calendar${calendarSemesterSuffix}`;
  const hrefSemesterCalendar = (semesterId: number) => {
    const q =
      defaultCalendarSemesterId != null &&
      semesterId === defaultCalendarSemesterId
        ? ""
        : `&calendarSemester=${semesterId}`;
    return `/?tab=calendar&calendarView=semester${q}`;
  };
  const semesterNavIdx = calendarSemesterNavList.findIndex(
    (s) => s.id === activeCalendarSemesterId,
  );
  const prevSemesterId =
    semesterNavIdx > 0 ? calendarSemesterNavList[semesterNavIdx - 1]?.id : null;
  const nextSemesterId =
    semesterNavIdx >= 0 && semesterNavIdx < calendarSemesterNavList.length - 1
      ? calendarSemesterNavList[semesterNavIdx + 1]?.id
      : null;

  let weekIndex = 1;

  const sessionsByDay = new Map<string, SessionItem[]>();
  for (const item of allSessions) {
    const key = shanghaiDayjs(item.date).format("YYYY-MM-DD");
    const list = sessionsByDay.get(key) ?? [];
    list.push(item);
    sessionsByDay.set(key, list);
  }
  const examsByDay = new Map<string, ExamItem[]>();
  for (const exam of allExams) {
    if (!exam.date) continue;
    const key = shanghaiDayjs(exam.date).format("YYYY-MM-DD");
    const list = examsByDay.get(key) ?? [];
    list.push(exam);
    examsByDay.set(key, list);
  }
  const homeworksByDay = new Map<string, typeof semesterHomeworks>();
  for (const hw of semesterHomeworks) {
    if (!hw.submissionDueAt) continue;
    const key = shanghaiDayjs(hw.submissionDueAt).format("YYYY-MM-DD");
    const list = homeworksByDay.get(key) ?? [];
    list.push(hw);
    homeworksByDay.set(key, list);
  }
  const todosByDay = new Map<string, CalendarTodoItem[]>();
  for (const todo of semesterTodos) {
    const key = shanghaiDayjs(todo.dueAt).format("YYYY-MM-DD");
    const list = todosByDay.get(key) ?? [];
    list.push(todo);
    todosByDay.set(key, list);
  }

  const weekStartsOn: 0 | 1 = 0;
  const monthBase = parseMonthParam(month) ?? referenceNow.startOf("month");
  const currentMonthLabel = monthBase.format("YYYY.MM");
  const monthPrev = monthBase.subtract(1, "month");
  const monthNext = monthBase.add(1, "month");

  const monthGridStart = getWeekStart(monthBase, weekStartsOn);
  const monthGridDays = Array.from({ length: 42 }, (_, i) =>
    monthGridStart.add(i, "day"),
  );
  const monthWeeks = Array.from({ length: 6 }, (_, idx) =>
    monthGridDays.slice(idx * 7, idx * 7 + 7),
  );

  const resolveWeekNumber = (weekStart: dayjs.Dayjs) => {
    if (!semesterStart || !semesterEnd) return null;
    const start = shanghaiDayjs(semesterStart);
    const end = shanghaiDayjs(semesterEnd);
    const weekEnd = weekStart.add(6, "day");
    if (weekEnd.isBefore(start, "day") || weekStart.isAfter(end, "day"))
      return null;
    const semesterWeekStart = getWeekStart(start, weekStartsOn);
    return weekStart.diff(semesterWeekStart, "week") + 1;
  };

  const weekNavHrefBase = `${baseHref}&calendarView=week`;
  const weekNavStart = getWeekStart(
    parseWeekParam(week) ?? getWeekStart(referenceNow, weekStartsOn),
    weekStartsOn,
  );
  const weekNavPrev = weekNavStart.subtract(7, "day");
  const weekNavNext = weekNavStart.add(7, "day");
  const weekNavNumber = resolveWeekNumber(weekNavStart);
  const weekNavLabel =
    weekNavNumber != null
      ? weekLabelTemplate.replace("{week}", String(weekNavNumber))
      : "—";
  const weekNavLink = (d: dayjs.Dayjs) =>
    `${weekNavHrefBase}&calendarWeek=${d.format("YYYY-MM-DD")}`;

  const contextNavBtnClass =
    "shrink-0 rounded-lg px-2.5 py-1.5 text-sm no-underline transition-colors hover:bg-background/90";
  const contextNavLabelClass =
    "min-w-0 shrink text-center font-medium text-foreground text-sm";
  const calendarGridFrameClass =
    "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1 rounded-2xl border border-border/70 bg-card/50 p-1";
  const calendarGridHeaderCellClass =
    "rounded-xl bg-background/85 px-1 py-3 text-center font-medium text-muted-foreground text-xs";
  const calendarGridWeekLabelClass =
    "flex items-start justify-center rounded-xl bg-background/70 px-1 py-2 font-medium text-[0.65rem] text-muted-foreground";

  return (
    <div className="min-w-0 space-y-3">
      <DashboardTabToolbar className="grid grid-cols-1 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-0">
        <div className="flex justify-start">
          <DashboardTabToolbarGroup className="shrink-0 overflow-hidden">
            {(
              [
                { id: "semester", labelKey: "calendarViewSemester" as const },
                { id: "month", labelKey: "calendarViewMonth" as const },
                { id: "week", labelKey: "calendarViewWeek" as const },
              ] as const
            ).map((item) => {
              const active = currentView === item.id;
              return (
                <Link
                  key={item.id}
                  href={`${baseHref}&calendarView=${item.id}`}
                  className={dashboardTabToolbarItemClass(active)}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </DashboardTabToolbarGroup>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          {currentView === "month" ? (
            <DashboardTabToolbarGroup className="justify-center">
              <Link
                href={`${baseHref}&calendarView=month&calendarMonth=${monthPrev.format("YYYY-MM")}`}
                className={contextNavBtnClass}
              >
                {tSection("previousMonth")}
              </Link>
              <span
                className={cn(
                  contextNavLabelClass,
                  "max-w-[12rem] truncate sm:max-w-none",
                )}
              >
                {currentMonthLabel}
              </span>
              <Link
                href={`${baseHref}&calendarView=month&calendarMonth=${monthNext.format("YYYY-MM")}`}
                className={contextNavBtnClass}
              >
                {tSection("nextMonth")}
              </Link>
            </DashboardTabToolbarGroup>
          ) : currentView === "week" ? (
            <DashboardTabToolbarGroup className="justify-center">
              <Link
                href={weekNavLink(weekNavPrev)}
                className={contextNavBtnClass}
              >
                {t("calendarWeek.prev")}
              </Link>
              <span className={contextNavLabelClass}>{weekNavLabel}</span>
              <Link
                href={weekNavLink(weekNavNext)}
                className={contextNavBtnClass}
              >
                {t("calendarWeek.next")}
              </Link>
            </DashboardTabToolbarGroup>
          ) : (
            <DashboardTabToolbarGroup className="justify-center">
              {prevSemesterId != null ? (
                <Link
                  href={hrefSemesterCalendar(prevSemesterId)}
                  className={contextNavBtnClass}
                >
                  {t("calendarSemesterPrev")}
                </Link>
              ) : (
                <span
                  className={cn(
                    contextNavBtnClass,
                    "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent hover:text-muted-foreground",
                  )}
                  aria-disabled
                >
                  {t("calendarSemesterPrev")}
                </span>
              )}
              <span
                className={cn(
                  contextNavLabelClass,
                  "max-w-[min(100%,14rem)] truncate",
                )}
              >
                {activeCalendarSemesterName ?? "—"}
              </span>
              {nextSemesterId != null ? (
                <Link
                  href={hrefSemesterCalendar(nextSemesterId)}
                  className={contextNavBtnClass}
                >
                  {t("calendarSemesterNext")}
                </Link>
              ) : (
                <span
                  className={cn(
                    contextNavBtnClass,
                    "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent hover:text-muted-foreground",
                  )}
                  aria-disabled
                >
                  {t("calendarSemesterNext")}
                </span>
              )}
            </DashboardTabToolbarGroup>
          )}
        </div>
        <div className="flex justify-center sm:shrink-0 sm:justify-end">
          {calendarSubscriptionUrl ? (
            <CopyCalendarLinkButton
              url={calendarSubscriptionUrl}
              label={tSubscriptions("iCalLink")}
              copiedMessage={tSubscriptions("linkCopied")}
              copiedDescription={tSubscriptions("linkCopiedDescription")}
            />
          ) : null}
        </div>
      </DashboardTabToolbar>

      {currentView === "month" ? (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={calendarGridFrameClass}>
                <div
                  className={cn(calendarGridHeaderCellClass, "rounded-t-xl")}
                >
                  {tSection("weekLabel")}
                </div>
                {weekdayLabels.map((label) => (
                  <div key={label} className={calendarGridHeaderCellClass}>
                    {label}
                  </div>
                ))}

                {monthWeeks.map((weekDaysInGrid) => {
                  const ws = weekDaysInGrid[0];
                  const wKey = ws.format("YYYY-MM-DD");
                  const wn = resolveWeekNumber(ws);
                  const wLabel =
                    wn != null
                      ? weekLabelTemplate.replace("{week}", String(wn))
                      : "—";
                  return (
                    <div key={wKey} className="contents">
                      <div className={calendarGridWeekLabelClass}>
                        <span className="[text-orientation:mixed] [writing-mode:vertical-rl]">
                          {wLabel}
                        </span>
                      </div>
                      {weekDaysInGrid.map((day) => {
                        const dateKey = day.format("YYYY-MM-DD");
                        const isToday = day.isSame(todayStart, "day");
                        const isCurrentMonth =
                          day.month() === monthBase.month();
                        const daySessions = sessionsByDay.get(dateKey) ?? [];
                        const dayExams = examsByDay.get(dateKey) ?? [];
                        const dayHomeworks = homeworksByDay.get(dateKey) ?? [];
                        const dayTodos = todosByDay.get(dateKey) ?? [];
                        return (
                          <div
                            key={dateKey}
                            className={cn(
                              "min-h-[7rem] min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background/95 p-1.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                              !isCurrentMonth && "bg-background/75 opacity-70",
                            )}
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
                              {day.date() === 1 && (
                                <span className="text-[0.65rem] text-muted-foreground">
                                  {day.format("M 月")}
                                </span>
                              )}
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
                                  ? shanghaiDayjs(hw.submissionDueAt).format(
                                      "HH:mm",
                                    )
                                  : "";
                                const descRaw =
                                  hw.description?.content?.trim() ?? "";
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
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : currentView === "week" ? (
        <DashboardWeekCalendar
          data={{
            allSessions,
            allExams,
            semesterHomeworks,
            semesterTodos,
            todayStart,
            semesterStart,
            semesterEnd,
            referenceNow,
          }}
          week={week}
          navHrefBase={`${baseHref}&calendarView=week`}
          weekQueryKey="calendarWeek"
          showWeekNav={false}
        />
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className={calendarGridFrameClass}>
                <div
                  className={cn(calendarGridHeaderCellClass, "rounded-t-xl")}
                >
                  {tSection("weekLabel")}
                </div>
                {weekdayLabels.map((label) => (
                  <div key={label} className={calendarGridHeaderCellClass}>
                    {label}
                  </div>
                ))}
                {semesterWeeks.map((week) => {
                  const weekLabel = weekLabelTemplate.replace(
                    "{week}",
                    String(weekIndex),
                  );
                  weekIndex += 1;
                  return (
                    <div
                      key={week[0].format("YYYY-MM-DD")}
                      className="contents"
                    >
                      <div className={calendarGridWeekLabelClass}>
                        <span className="[text-orientation:mixed] [writing-mode:vertical-rl]">
                          {weekLabel}
                        </span>
                      </div>
                      {week.map((day) => {
                        const dateKey = day.format("YYYY-MM-DD");
                        const daySessions = sessionsByDay.get(dateKey) ?? [];
                        const dayExams = examsByDay.get(dateKey) ?? [];
                        const dayHomeworks = homeworksByDay.get(dateKey) ?? [];
                        const dayTodos = todosByDay.get(dateKey) ?? [];
                        const isToday = day.isSame(todayStart, "day");

                        return (
                          <div
                            key={dateKey}
                            className="min-h-[7rem] min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background/95 p-1.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
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
                              {day.date() === 1 && (
                                <span className="text-[0.65rem] text-muted-foreground">
                                  {day.format("M 月")}
                                </span>
                              )}
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
                                  ? shanghaiDayjs(hw.submissionDueAt).format(
                                      "HH:mm",
                                    )
                                  : "";
                                const descRaw =
                                  hw.description?.content?.trim() ?? "";
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
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
