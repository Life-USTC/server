import { type ICalCalendar, ICalEventBusyStatus } from "ical-generator";
import type { AppLocale } from "@/i18n/config";
import { ICAL_SITE_URL } from "@/lib/ical-event-constants";
import type { CalendarHomework, CalendarTodo } from "@/lib/ical-event-types";
import { toCategories } from "@/lib/ical-event-utils";
import { getIcalLabels, priorityLabel } from "@/lib/ical-labels";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export function createHomeworkEvent(
  homework: CalendarHomework,
  calendar: ICalCalendar,
  locale: AppLocale,
) {
  if (!homework.submissionDueAt) return;

  const L = getIcalLabels(locale);
  const dueDate = shanghaiDayjs(homework.submissionDueAt);
  const courseName = homework.section.course.nameCn;
  const section = homework.section;

  const description = [
    `${courseName} (${section.code})`,
    homework.isMajor ? L.majorHomework : null,
    homework.requiresTeam ? L.requiresTeam : null,
    homework.description?.content?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n");

  calendar.createEvent({
    start: dueDate,
    end: dueDate.add(30, "minute"),
    timezone: APP_TIME_ZONE,
    summary: `${courseName} - ${L.homeworkDuePrefix}${homework.title}`,
    description,
    id: `${ICAL_SITE_URL}/homework/${homework.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.FREE,
    categories: toCategories([
      L.homeworkCategory,
      courseName,
      section.code,
      section.course.code,
      homework.isMajor ? L.majorHomework : null,
    ]),
  });
}

export function createTodoEvent(
  todo: CalendarTodo,
  calendar: ICalCalendar,
  locale: AppLocale,
) {
  const L = getIcalLabels(locale);
  const dueDate = shanghaiDayjs(todo.dueAt);
  const pLabel = priorityLabel(todo.priority, locale);

  const description = [pLabel, todo.content?.trim() || null]
    .filter(Boolean)
    .join("\n");

  calendar.createEvent({
    start: dueDate,
    end: dueDate.add(30, "minute"),
    timezone: APP_TIME_ZONE,
    summary: `${L.todoDuePrefix}${todo.title}`,
    description,
    id: `${ICAL_SITE_URL}/todo/${todo.id}`,
    sequence: 0,
    busystatus: ICalEventBusyStatus.FREE,
    categories: toCategories([L.todoCategory, pLabel]),
  });
}
