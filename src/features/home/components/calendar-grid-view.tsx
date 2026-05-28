import type dayjs from "dayjs";
import type {
  CalendarTodoItem,
  OverviewData,
} from "@/features/home/server/dashboard-overview-data";
import type {
  ExamItem,
  SessionItem,
} from "@/features/home/server/dashboard-types";
import { cn } from "@/lib/utils";
import { CalendarDayCell } from "./calendar-day-cell";

type HomeworkCalendarItem = OverviewData["semesterHomeworks"][number];

const calendarGridFrameClass =
  "grid min-w-full grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-0.5 rounded-xl border border-border/70 bg-card/50 p-0.5 sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] sm:gap-1 sm:rounded-2xl sm:p-1";

const calendarGridHeaderCellClass =
  "rounded-lg bg-background/85 px-0.5 py-2 text-center font-medium text-muted-foreground text-[0.65rem] sm:rounded-xl sm:px-1 sm:py-3 sm:text-xs";

const calendarGridWeekLabelClass =
  "flex items-start justify-center rounded-lg bg-background/70 px-0.5 py-1.5 font-medium text-muted-foreground text-[0.55rem] sm:rounded-xl sm:px-1 sm:py-2 sm:text-[0.65rem]";

type CalendarWeekRow = {
  days: dayjs.Dayjs[];
  key: string;
  label: string;
};

export function CalendarGridView({
  examsByDay,
  homeworksByDay,
  monthBase,
  sessionsByDay,
  tSection,
  tTodos,
  todosByDay,
  todayStart,
  weekRows,
  weekdayLabels,
}: {
  examsByDay: Map<string, ExamItem[]>;
  homeworksByDay: Map<string, HomeworkCalendarItem[]>;
  monthBase?: dayjs.Dayjs;
  sessionsByDay: Map<string, SessionItem[]>;
  tSection: (key: string, values?: Record<string, string | number>) => string;
  tTodos: (key: string, values?: Record<string, string | number>) => string;
  todosByDay: Map<string, CalendarTodoItem[]>;
  todayStart: dayjs.Dayjs;
  weekRows: CalendarWeekRow[];
  weekdayLabels: string[];
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        <div className="min-w-full">
          <div className={calendarGridFrameClass}>
            <div className={cn(calendarGridHeaderCellClass, "rounded-t-xl")}>
              {tSection("weekLabel")}
            </div>
            {weekdayLabels.map((label) => (
              <div key={label} className={calendarGridHeaderCellClass}>
                {label}
              </div>
            ))}

            {weekRows.map((week) => (
              <div key={week.key} className="contents">
                <div className={calendarGridWeekLabelClass}>
                  <span className="[text-orientation:mixed] [writing-mode:vertical-rl]">
                    {week.label}
                  </span>
                </div>
                {week.days.map((day) => {
                  const dateKey = day.format("YYYY-MM-DD");
                  return (
                    <CalendarDayCell
                      key={dateKey}
                      day={day}
                      exams={examsByDay.get(dateKey) ?? []}
                      homeworks={homeworksByDay.get(dateKey) ?? []}
                      isCurrentMonth={
                        monthBase ? day.month() === monthBase.month() : true
                      }
                      isToday={day.isSame(todayStart, "day")}
                      sessions={sessionsByDay.get(dateKey) ?? []}
                      tSection={tSection}
                      todos={todosByDay.get(dateKey) ?? []}
                      tTodos={tTodos}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
