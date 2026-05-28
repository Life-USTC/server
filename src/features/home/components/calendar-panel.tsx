import type dayjs from "dayjs";
import { getTranslations } from "next-intl/server";
import { CopyCalendarLinkButton } from "@/components/copy-calendar-link-button";
import {
  DashboardTabToolbar,
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import {
  CalendarDayCell,
  EmptyCalendarPanel,
} from "@/features/home/components/calendar-day-cell";
import {
  getSemesterWeekNumber,
  getWeekStart,
  groupByShanghaiDay,
  parseCalendarView,
  parseMonthParam,
  parseWeekParam,
  WEEKDAY_KEYS,
} from "@/features/home/components/calendar-panel-shared";
import { DashboardWeekCalendar } from "@/features/home/components/dashboard-week-calendar";
import type { OverviewData } from "@/features/home/server/dashboard-overview-data";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const calendarGridFrameClass =
  "grid min-w-full grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-0.5 rounded-xl border border-border/70 bg-card/50 p-0.5 sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] sm:gap-1 sm:rounded-2xl sm:p-1";
const calendarGridHeaderCellClass =
  "rounded-lg bg-background/85 px-0.5 py-2 text-center font-medium text-muted-foreground text-[0.65rem] sm:rounded-xl sm:px-1 sm:py-3 sm:text-xs";
const calendarGridWeekLabelClass =
  "flex items-start justify-center rounded-lg bg-background/70 px-0.5 py-1.5 font-medium text-muted-foreground text-[0.55rem] sm:rounded-xl sm:px-1 sm:py-2 sm:text-[0.65rem]";
const contextNavBtnClass =
  "shrink-0 rounded-lg px-2.5 py-1.5 text-sm no-underline transition-colors hover:bg-background/90";
const contextNavLabelClass =
  "min-w-0 shrink text-center font-medium text-foreground text-sm";

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
    return <EmptyCalendarPanel title={t("today.empty")} />;
  }

  const currentView = parseCalendarView(view);
  const calendarSemesterSuffix =
    activeCalendarSemesterId != null &&
    (defaultCalendarSemesterId == null ||
      activeCalendarSemesterId !== defaultCalendarSemesterId)
      ? `&calendarSemester=${activeCalendarSemesterId}`
      : "";
  const baseHref = `/?tab=calendar${calendarSemesterSuffix}`;

  const sessionsByDay = groupByShanghaiDay(allSessions, (item) => item.date);
  const examsByDay = groupByShanghaiDay(allExams, (exam) => exam.date);
  const homeworksByDay = groupByShanghaiDay(
    semesterHomeworks,
    (homework) => homework.submissionDueAt,
  );
  const todosByDay = groupByShanghaiDay(semesterTodos, (todo) => todo.dueAt);

  const weekStartsOn: 0 | 1 = 0;

  const resolveWeekNumber = (weekStart: dayjs.Dayjs) =>
    getSemesterWeekNumber({
      semesterEnd,
      semesterStart,
      weekStart,
      weekStartsOn,
    });

  // Semester navigation
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

  // Week navigation
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

  // Month grid data
  const monthBase = parseMonthParam(month) ?? referenceNow.startOf("month");
  const monthGridStart = getWeekStart(monthBase, weekStartsOn);
  const monthGridDays = Array.from({ length: 42 }, (_, i) =>
    monthGridStart.add(i, "day"),
  );
  const monthWeeks = Array.from({ length: 6 }, (_, idx) =>
    monthGridDays.slice(idx * 7, idx * 7 + 7),
  );

  const dayEvents = (day: dayjs.Dayjs) => {
    const key = day.format("YYYY-MM-DD");
    return {
      sessions: sessionsByDay.get(key) ?? [],
      exams: examsByDay.get(key) ?? [],
      homeworks: homeworksByDay.get(key) ?? [],
      todos: todosByDay.get(key) ?? [],
    };
  };

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
            <MonthNav
              baseHref={baseHref}
              monthBase={monthBase}
              prevLabel={tSection("previousMonth")}
              nextLabel={tSection("nextMonth")}
            />
          ) : currentView === "week" ? (
            <WeekNav
              weekNavPrev={weekNavPrev}
              weekNavNext={weekNavNext}
              weekNavLabel={weekNavLabel}
              weekNavLink={weekNavLink}
              prevLabel={t("calendarWeek.prev")}
              nextLabel={t("calendarWeek.next")}
            />
          ) : (
            <SemesterNav
              prevSemesterId={prevSemesterId}
              nextSemesterId={nextSemesterId}
              hrefSemesterCalendar={hrefSemesterCalendar}
              activeCalendarSemesterName={activeCalendarSemesterName ?? "—"}
              prevLabel={t("calendarSemesterPrev")}
              nextLabel={t("calendarSemesterNext")}
            />
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
        <CalendarMonthGrid
          weekdayLabels={weekdayLabels}
          weekLabelHeading={tSection("weekLabel")}
          monthWeeks={monthWeeks}
          weekLabelTemplate={weekLabelTemplate}
          resolveWeekNumber={resolveWeekNumber}
          monthBase={monthBase}
          todayStart={todayStart}
          dayEvents={dayEvents}
          tSection={tSection}
          tTodos={tTodos}
        />
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
        <CalendarSemesterGrid
          weekdayLabels={weekdayLabels}
          weekLabelHeading={tSection("weekLabel")}
          semesterWeeks={semesterWeeks}
          weekLabelTemplate={weekLabelTemplate}
          todayStart={todayStart}
          dayEvents={dayEvents}
          tSection={tSection}
          tTodos={tTodos}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid sub-components                                                */
/* ------------------------------------------------------------------ */

function CalendarGridHeader({
  weekdayLabels,
  weekLabelHeading,
}: {
  weekdayLabels: string[];
  weekLabelHeading: string;
}) {
  return (
    <>
      <div className={cn(calendarGridHeaderCellClass, "rounded-t-xl")}>
        {weekLabelHeading}
      </div>
      {weekdayLabels.map((label) => (
        <div key={label} className={calendarGridHeaderCellClass}>
          {label}
        </div>
      ))}
    </>
  );
}

function CalendarMonthGrid({
  weekdayLabels,
  weekLabelHeading,
  monthWeeks,
  weekLabelTemplate,
  resolveWeekNumber,
  monthBase,
  todayStart,
  dayEvents,
  tSection,
  tTodos,
}: {
  weekdayLabels: string[];
  weekLabelHeading: string;
  monthWeeks: dayjs.Dayjs[][];
  weekLabelTemplate: string;
  resolveWeekNumber: (ws: dayjs.Dayjs) => number | null;
  monthBase: dayjs.Dayjs;
  todayStart: dayjs.Dayjs;
  dayEvents: (day: dayjs.Dayjs) => {
    sessions: OverviewData["allSessions"];
    exams: OverviewData["allExams"];
    homeworks: OverviewData["semesterHomeworks"];
    todos: OverviewData["semesterTodos"];
  };
  tSection: (key: string, values?: Record<string, string | number>) => string;
  tTodos: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full">
          <div className={calendarGridFrameClass}>
            <CalendarGridHeader
              weekdayLabels={weekdayLabels}
              weekLabelHeading={weekLabelHeading}
            />
            {monthWeeks.map((weekDays) => {
              const ws = weekDays[0];
              const wn = resolveWeekNumber(ws);
              const wLabel =
                wn != null
                  ? weekLabelTemplate.replace("{week}", String(wn))
                  : "—";
              return (
                <div key={ws.format("YYYY-MM-DD")} className="contents">
                  <div className={calendarGridWeekLabelClass}>
                    <span className="[text-orientation:mixed] [writing-mode:vertical-rl]">
                      {wLabel}
                    </span>
                  </div>
                  {weekDays.map((day) => {
                    const ev = dayEvents(day);
                    return (
                      <CalendarDayCell
                        key={day.format("YYYY-MM-DD")}
                        day={day}
                        sessions={ev.sessions}
                        exams={ev.exams}
                        homeworks={ev.homeworks}
                        todos={ev.todos}
                        isCurrentMonth={day.month() === monthBase.month()}
                        isToday={day.isSame(todayStart, "day")}
                        tSection={tSection}
                        tTodos={tTodos}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarSemesterGrid({
  weekdayLabels,
  weekLabelHeading,
  semesterWeeks,
  weekLabelTemplate,
  todayStart,
  dayEvents,
  tSection,
  tTodos,
}: {
  weekdayLabels: string[];
  weekLabelHeading: string;
  semesterWeeks: dayjs.Dayjs[][];
  weekLabelTemplate: string;
  todayStart: dayjs.Dayjs;
  dayEvents: (day: dayjs.Dayjs) => {
    sessions: OverviewData["allSessions"];
    exams: OverviewData["allExams"];
    homeworks: OverviewData["semesterHomeworks"];
    todos: OverviewData["semesterTodos"];
  };
  tSection: (key: string, values?: Record<string, string | number>) => string;
  tTodos: (key: string, values?: Record<string, string | number>) => string;
}) {
  let weekIndex = 1;

  return (
    <div className="space-y-2">
      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full">
          <div className={calendarGridFrameClass}>
            <CalendarGridHeader
              weekdayLabels={weekdayLabels}
              weekLabelHeading={weekLabelHeading}
            />
            {semesterWeeks.map((weekDays) => {
              const wLabel = weekLabelTemplate.replace(
                "{week}",
                String(weekIndex),
              );
              weekIndex += 1;
              return (
                <div
                  key={weekDays[0].format("YYYY-MM-DD")}
                  className="contents"
                >
                  <div className={calendarGridWeekLabelClass}>
                    <span className="[text-orientation:mixed] [writing-mode:vertical-rl]">
                      {wLabel}
                    </span>
                  </div>
                  {weekDays.map((day) => {
                    const ev = dayEvents(day);
                    return (
                      <CalendarDayCell
                        key={day.format("YYYY-MM-DD")}
                        day={day}
                        sessions={ev.sessions}
                        exams={ev.exams}
                        homeworks={ev.homeworks}
                        todos={ev.todos}
                        isCurrentMonth={true}
                        isToday={day.isSame(todayStart, "day")}
                        tSection={tSection}
                        tTodos={tTodos}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation sub-components                                          */
/* ------------------------------------------------------------------ */

function MonthNav({
  baseHref,
  monthBase,
  prevLabel,
  nextLabel,
}: {
  baseHref: string;
  monthBase: dayjs.Dayjs;
  prevLabel: string;
  nextLabel: string;
}) {
  const currentLabel = monthBase.format("YYYY.MM");

  return (
    <DashboardTabToolbarGroup className="justify-center">
      <Link
        href={`${baseHref}&calendarView=month&calendarMonth=${monthBase.subtract(1, "month").format("YYYY-MM")}`}
        className={contextNavBtnClass}
      >
        {prevLabel}
      </Link>
      <span
        className={cn(
          contextNavLabelClass,
          "max-w-[12rem] truncate sm:max-w-none",
        )}
      >
        {currentLabel}
      </span>
      <Link
        href={`${baseHref}&calendarView=month&calendarMonth=${monthBase.add(1, "month").format("YYYY-MM")}`}
        className={contextNavBtnClass}
      >
        {nextLabel}
      </Link>
    </DashboardTabToolbarGroup>
  );
}

function WeekNav({
  weekNavPrev,
  weekNavNext,
  weekNavLabel,
  weekNavLink,
  prevLabel,
  nextLabel,
}: {
  weekNavPrev: dayjs.Dayjs;
  weekNavNext: dayjs.Dayjs;
  weekNavLabel: string;
  weekNavLink: (d: dayjs.Dayjs) => string;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <DashboardTabToolbarGroup className="justify-center">
      <Link href={weekNavLink(weekNavPrev)} className={contextNavBtnClass}>
        {prevLabel}
      </Link>
      <span className={contextNavLabelClass}>{weekNavLabel}</span>
      <Link href={weekNavLink(weekNavNext)} className={contextNavBtnClass}>
        {nextLabel}
      </Link>
    </DashboardTabToolbarGroup>
  );
}

function SemesterNav({
  prevSemesterId,
  nextSemesterId,
  hrefSemesterCalendar,
  activeCalendarSemesterName,
  prevLabel,
  nextLabel,
}: {
  prevSemesterId: number | null;
  nextSemesterId: number | null;
  hrefSemesterCalendar: (id: number) => string;
  activeCalendarSemesterName: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const disabledClass = cn(
    contextNavBtnClass,
    "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent hover:text-muted-foreground",
  );

  return (
    <DashboardTabToolbarGroup className="justify-center">
      {prevSemesterId != null ? (
        <Link
          href={hrefSemesterCalendar(prevSemesterId)}
          className={contextNavBtnClass}
        >
          {prevLabel}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled>
          {prevLabel}
        </span>
      )}
      <span
        className={cn(contextNavLabelClass, "max-w-[min(100%,14rem)] truncate")}
      >
        {activeCalendarSemesterName}
      </span>
      {nextSemesterId != null ? (
        <Link
          href={hrefSemesterCalendar(nextSemesterId)}
          className={contextNavBtnClass}
        >
          {nextLabel}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled>
          {nextLabel}
        </span>
      )}
    </DashboardTabToolbarGroup>
  );
}
