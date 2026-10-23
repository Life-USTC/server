import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import {
  homeworkCalendarItem,
  personalCalendarItem,
  todoCalendarItem,
} from "@/features/calendar/server/personal-calendar-item";
import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { isHomeworkPendingForViewer } from "@/features/homeworks/lib/homework-completion-state";
import { getUserCalendarSubscription } from "@/features/subscriptions/server/subscription-calendar-read-model";
import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-homework-list";
import { listTodoSnapshots } from "@/features/todos/server/todo-service";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";
import { buildActionableOverviewProjection } from "./actionable-overview-projection";

export async function getActionableOverview(
  userId: string,
  {
    atTime = new Date(),
    locale = DEFAULT_LOCALE,
  }: { atTime?: Date; locale?: AppLocale } = {},
) {
  const dateFrom = startOfShanghaiDay(atTime);
  const dateTo = addShanghaiTime(dateFrom, 7, "day");
  const [events, homeworks, todos, subscription, currentSemester] =
    await Promise.all([
      listUserCalendarEvents(userId, {
        atTime,
        dateFrom,
        dateTo,
        sectionContext: "compact",
        locale,
      }),
      listSubscribedHomeworks(userId, {
        completed: false,
        now: atTime,
        locale,
      }),
      listTodoSnapshots({ where: { userId, completed: false } }),
      getUserCalendarSubscription(userId, locale),
      getCurrentSemester(atTime),
    ]);
  const sections = subscription?.sections ?? [];
  const kinds = new Map(sections.map((section) => [section.id, section.kind]));
  return {
    anchor: {
      atTime: toShanghaiIsoString(atTime),
      dateFrom: toShanghaiIsoString(dateFrom),
      dateTo: toShanghaiIsoString(dateTo),
    },
    ...buildActionableOverviewProjection({
      atTime,
      locale,
      events: events
        .filter(
          (event) => event.type !== "todo_due" && event.type !== "homework_due",
        )
        .map((event) => personalCalendarItem(event, kinds)),
      pendingDeadlines: [
        ...homeworks
          .filter((homework) => isHomeworkPendingForViewer(homework, atTime))
          .map((homework) => homeworkCalendarItem(homework, kinds)),
        ...todos.map(todoCalendarItem),
      ],
    }),
    subscriptions: {
      totalCount: sections.length,
      currentSemesterCount: sections.filter(
        (section) => section.semesterId === currentSemester?.id,
      ).length,
      currentSemester: currentSemester
        ? {
            id: currentSemester.id,
            nameCn: currentSemester.nameCn,
            startDate: toShanghaiIsoString(currentSemester.startDate),
            endDate: toShanghaiIsoString(currentSemester.endDate),
          }
        : null,
    },
  };
}
