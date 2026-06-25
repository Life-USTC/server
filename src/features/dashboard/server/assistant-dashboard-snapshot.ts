import type { AppLocale } from "@/i18n/config";
import {
  assistantNextClass,
  assistantUpcomingDeadlines,
} from "./assistant-dashboard-snapshot-events";
import { serializeAssistantSemester } from "./assistant-dashboard-snapshot-helpers";
import { loadAssistantDashboardSnapshotData } from "./assistant-dashboard-snapshot-queries";

export async function getAssistantDashboardSnapshot(input: {
  userId: string;
  locale: AppLocale;
  dayLimit?: number;
  atTime?: Date;
}) {
  const now = input.atTime ?? new Date();
  const dayLimit = input.dayLimit ?? 7;
  const dateTo = new Date(now.getTime() + dayLimit * 24 * 60 * 60 * 1000);
  const {
    bus,
    currentSemester,
    currentSemesterSections,
    events,
    incompleteTodoCount,
    incompleteTodos,
    sectionIds,
    user,
  } = await loadAssistantDashboardSnapshotData({
    dateTo,
    locale: input.locale,
    now,
    userId: input.userId,
  });

  if (!user) {
    throw new Error(`User ${input.userId} not found`);
  }

  const nextClass = assistantNextClass(events, now);
  const upcomingDeadlines = assistantUpcomingDeadlines(events);

  return {
    user,
    currentSemester: serializeAssistantSemester(currentSemester),
    subscriptions: {
      totalCount: sectionIds.length,
      currentSemesterCount: currentSemesterSections.length,
      currentSemesterSections,
    },
    nextClass,
    upcomingDeadlines,
    upcomingEvents: events.slice(0, 10),
    todos: {
      incompleteCount: incompleteTodoCount,
      items: incompleteTodos,
    },
    bus,
  };
}
