import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { listDueTodoSnapshots } from "@/features/todos/server/todo-service";
import {
  getSubscribedSectionIds,
  listSubscribedExams,
  listSubscribedHomeworks,
  listSubscribedSchedules,
} from "./subscription-read-model";

export async function loadCalendarEventSources({
  calendarDateEnd,
  calendarDateStart,
  includeWindowEnd,
  locale,
  sectionIds,
  userId,
  windowEnd,
  windowStart,
}: {
  calendarDateEnd: Date;
  calendarDateStart: Date;
  includeWindowEnd: boolean;
  locale: string;
  sectionIds?: readonly number[];
  userId: string;
  windowEnd: Date;
  windowStart: Date;
}) {
  const scopedSectionIds = sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);

  const [schedules, homeworks, exams, todos] = await Promise.all([
    listSubscribedSchedules(userId, {
      locale,
      dateFrom: calendarDateStart,
      dateTo: calendarDateEnd,
      sectionIds: scopedSectionIds,
    }),
    listSubscribedHomeworks(userId, {
      locale,
      completed: false,
      dueAtFrom: windowStart,
      dueAtTo: windowEnd,
      sectionIds: scopedSectionIds,
    }),
    listSubscribedExams(userId, {
      locale,
      dateFrom: calendarDateStart,
      dateTo: calendarDateEnd,
      includeDateUnknown: false,
      sectionIds: scopedSectionIds,
    }),
    listDueTodoSnapshots({
      completed: false,
      dueAtFrom: windowStart,
      dueAtTo: windowEnd,
      includeDueAtTo: includeWindowEnd,
      userId,
    }),
  ]);

  return {
    exams,
    homeworkItems: await withHomeworkItemState(homeworks),
    schedules,
    todos,
  };
}
