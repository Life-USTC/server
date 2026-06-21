import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import {
  countIncompleteTodos,
  listTodoSnapshots,
  todoDueDateOrderBy,
} from "@/features/todos/server/todo-service";
import type { AppLocale } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import {
  listAssistantCurrentSemesterSections,
  resolveAssistantBusSnapshot,
} from "./assistant-dashboard-snapshot-helpers";
import { listUserCalendarEvents } from "./calendar-events";
import { getSubscribedSectionIds } from "./subscription-read-model";

export async function loadAssistantDashboardSnapshotData(input: {
  dateTo: Date;
  locale: AppLocale;
  now: Date;
  userId: string;
}) {
  const currentSemester = await getCurrentSemester(input.now);
  const localizedPrisma = getPrisma(input.locale);
  const sectionIdsPromise = getSubscribedSectionIds(input.userId);

  const [
    user,
    sectionIds,
    currentSemesterSections,
    events,
    incompleteTodos,
    incompleteTodoCount,
    bus,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
    }),
    sectionIdsPromise,
    sectionIdsPromise.then((sectionIds) =>
      listAssistantCurrentSemesterSections({
        currentSemesterId: currentSemester?.id ?? null,
        localizedPrisma,
        sectionIds,
      }),
    ),
    sectionIdsPromise.then((sectionIds) =>
      listUserCalendarEvents(input.userId, {
        locale: input.locale,
        dateFrom: input.now,
        dateTo: input.dateTo,
        eventWindowMode: "start",
        sectionIds,
      }),
    ),
    listTodoSnapshots({
      where: {
        userId: input.userId,
        completed: false,
      },
      orderBy: todoDueDateOrderBy,
      take: 5,
    }),
    countIncompleteTodos(input.userId),
    resolveAssistantBusSnapshot({
      locale: input.locale,
      now: input.now,
      userId: input.userId,
    }),
  ]);

  return {
    bus,
    currentSemester,
    currentSemesterSections,
    events,
    incompleteTodoCount,
    incompleteTodos,
    sectionIds,
    user,
  };
}
