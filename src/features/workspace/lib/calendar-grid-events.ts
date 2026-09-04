import type { CalendarGridEvent } from "$lib/components/calendar/types";

type CalendarSession = {
  courseName: string;
};

type CalendarExam = {
  courseName: string;
};

type CalendarHomework = {
  completion?: unknown;
  completed?: boolean;
  title: string;
};

type CalendarTodo = {
  completed?: boolean;
  title: string;
};

type CalendarDayEvents<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
> = {
  sessions: Session[];
  exams: Exam[];
  homeworks: Homework[];
  todos: Todo[];
};

type CalendarEventChipFields = {
  detail: string;
  meta: string;
  tooltipDetail?: string;
};

type CalendarGridEventOptions<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
> = {
  calendarEventParts: (parts: string[]) => string;
  calendarExamChipFields: (exam: Exam) => CalendarEventChipFields;
  calendarHomeworkChipFields: (homework: Homework) => CalendarEventChipFields;
  calendarHomeworkHref: (homework: Homework) => string;
  calendarSessionChipFields: (session: Session) => CalendarEventChipFields;
  calendarTodoChipFields: (todo: Todo) => CalendarEventChipFields;
  dashboardTabHref: (tab: "exams" | "todos") => string;
  examLabel: string;
  sessionHref: (session: Session) => string;
};

function chipTooltip(
  label: string,
  fields: CalendarEventChipFields,
  calendarEventParts: (parts: string[]) => string,
) {
  return calendarEventParts([
    label,
    fields.meta,
    fields.tooltipDetail ?? fields.detail,
  ]);
}

export function calendarGridEventsForDay<
  Session extends CalendarSession,
  Exam extends CalendarExam,
  Homework extends CalendarHomework,
  Todo extends CalendarTodo,
>(
  events: CalendarDayEvents<Session, Exam, Homework, Todo>,
  options: CalendarGridEventOptions<Session, Exam, Homework, Todo>,
): CalendarGridEvent[] {
  return [
    ...events.sessions.map((session) => {
      const fields = options.calendarSessionChipFields(session);
      return {
        href: options.sessionHref(session),
        label: session.courseName,
        meta: fields.meta,
        detail: fields.detail,
        tooltipDetail: fields.tooltipDetail,
        tooltip: chipTooltip(
          session.courseName,
          fields,
          options.calendarEventParts,
        ),
        tone: "info" as const,
      };
    }),
    ...events.exams.map((exam) => {
      const fields = options.calendarExamChipFields(exam);
      const label = `${exam.courseName} · ${options.examLabel}`;
      return {
        href: options.dashboardTabHref("exams"),
        label,
        meta: fields.meta,
        detail: fields.detail,
        tooltipDetail: fields.tooltipDetail,
        tooltip: chipTooltip(label, fields, options.calendarEventParts),
        tone: "error" as const,
      };
    }),
    ...events.homeworks.map((homework) => {
      const fields = options.calendarHomeworkChipFields(homework);
      return {
        done: Boolean(homework.completed ?? homework.completion),
        href: options.calendarHomeworkHref(homework),
        label: homework.title,
        meta: fields.meta,
        detail: fields.detail,
        tooltipDetail: fields.tooltipDetail,
        tooltip: chipTooltip(
          homework.title,
          fields,
          options.calendarEventParts,
        ),
        tone: "warning" as const,
      };
    }),
    ...events.todos.map((todo) => {
      const fields = options.calendarTodoChipFields(todo);
      return {
        done: Boolean(todo.completed),
        href: options.dashboardTabHref("todos"),
        label: todo.title,
        meta: fields.meta,
        detail: fields.detail,
        tooltipDetail: fields.tooltipDetail,
        tooltip: chipTooltip(todo.title, fields, options.calendarEventParts),
        tone: "success" as const,
      };
    }),
  ];
}
