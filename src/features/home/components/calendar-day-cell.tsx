import type dayjs from "dayjs";
import { CalendarEventCardInteractive } from "@/components/calendar-event-card-interactive";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { CalendarDayTodoCards } from "@/features/home/components/calendar-day-todo-cards";
import type {
  CalendarTodoItem,
  OverviewData,
} from "@/features/home/server/dashboard-overview-data";
import type {
  ExamItem,
  SessionItem,
} from "@/features/home/server/dashboard-types";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { cn } from "@/lib/utils";
import { formatExamTypeLabel } from "@/shared/lib/exam-utils";
import { formatTime } from "@/shared/lib/time-utils";
import { compactLocation } from "./calendar-panel-shared";

type HomeworkCalendarItem = OverviewData["semesterHomeworks"][number];

export function CalendarDayCell({
  day,
  exams,
  homeworks,
  isCurrentMonth = true,
  isToday,
  sessions,
  tSection,
  todos,
  tTodos,
}: {
  day: dayjs.Dayjs;
  exams: ExamItem[];
  homeworks: HomeworkCalendarItem[];
  isCurrentMonth?: boolean;
  isToday: boolean;
  sessions: SessionItem[];
  tSection: (key: string, values?: Record<string, string | number>) => string;
  todos: CalendarTodoItem[];
  tTodos: (key: string, values?: Record<string, string | number>) => string;
}) {
  const mobileIndicators = [
    { key: "sessions", count: sessions.length, className: "bg-sky-500" },
    { key: "exams", count: exams.length, className: "bg-rose-500" },
    { key: "homeworks", count: homeworks.length, className: "bg-amber-500" },
    { key: "todos", count: todos.length, className: "bg-emerald-500" },
  ].filter((item) => item.count > 0);

  return (
    <div
      className={cn(
        "min-h-[3.75rem] min-w-0 overflow-hidden rounded-lg border border-border/50 bg-background/95 p-1 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[7rem] sm:rounded-xl sm:p-1.5",
        !isCurrentMonth && "bg-background/75 opacity-70",
      )}
    >
      <div className="mb-1 flex items-center justify-between sm:mb-1.5">
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full font-semibold text-[0.68rem] tabular-nums leading-none sm:h-6 sm:min-w-6 sm:text-xs",
            isToday ? "bg-foreground text-background" : "text-foreground",
          )}
        >
          {day.format("D")}
        </span>
        <span className="min-w-0 truncate text-[0.65rem] text-muted-foreground">
          <span className="sm:hidden">{day.format("ddd")}</span>
          {day.date() === 1 ? (
            <span className="ml-1 sm:ml-0">{day.format("M 月")}</span>
          ) : null}
        </span>
      </div>

      {mobileIndicators.length > 0 ? (
        <div className="flex flex-wrap items-center gap-0.5 sm:hidden">
          {mobileIndicators.map((item) => (
            <span
              key={item.key}
              className={cn(
                "inline-flex h-1.5 w-1.5 rounded-full",
                item.className,
              )}
            />
          ))}
        </div>
      ) : null}

      <div className="hidden min-w-0 space-y-1 overflow-hidden sm:block">
        {sessions.map((item) => {
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

        {exams.map((exam) => {
          const timeLabel =
            exam.startTime != null && exam.endTime != null
              ? `${formatTime(exam.startTime)}-${formatTime(exam.endTime)}`
              : "";
          const roomLabel = exam.rooms
            .map((room) => room.room)
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
                        value: formatExamTypeLabel(exam.examType, tSection),
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

        {homeworks.map((homework) => {
          const timeMeta = homework.submissionDueAt
            ? shanghaiDayjs(homework.submissionDueAt).format("HH:mm")
            : "";
          const descriptionRaw = homework.description?.content?.trim() ?? "";
          const description = descriptionRaw
            ? descriptionRaw.replace(/\s+/g, " ").slice(0, 120)
            : "";

          return (
            <CalendarEventCardInteractive
              key={homework.id}
              href="/?tab=homeworks"
              variant="homework"
              title={homework.title}
              time={timeMeta ? `${tTodos("dueLabel")} ${timeMeta}` : undefined}
              details={[
                ...(timeMeta
                  ? [
                      {
                        label: tTodos("dueAtLabel"),
                        value: timeMeta,
                      },
                    ]
                  : []),
                ...(description
                  ? [
                      {
                        label: tTodos("contentLabel"),
                        value: description,
                      },
                    ]
                  : []),
              ]}
            />
          );
        })}

        <CalendarDayTodoCards todos={todos} />
      </div>
    </div>
  );
}

export function EmptyCalendarPanel({ title }: { title: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
