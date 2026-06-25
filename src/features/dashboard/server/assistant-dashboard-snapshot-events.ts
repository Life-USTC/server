import { isUpcomingEventAt } from "./assistant-dashboard-snapshot-helpers";

type AssistantDashboardEvent = {
  at: Date | string | null;
  type: string;
};

type AssistantDeadlineEvent = AssistantDashboardEvent & {
  type: "homework_due" | "exam" | "todo_due";
};

export function assistantNextClass(
  events: readonly AssistantDashboardEvent[],
  now: Date,
) {
  return (
    events.find(
      (event) =>
        event.type === "schedule" &&
        isUpcomingEventAt(
          event.at instanceof Date ? event.at.toISOString() : event.at,
          now,
        ),
    ) ?? null
  );
}

export function assistantUpcomingDeadlines(
  events: readonly AssistantDashboardEvent[],
) {
  return events
    .filter(
      (event): event is AssistantDeadlineEvent =>
        event.type === "homework_due" ||
        event.type === "exam" ||
        event.type === "todo_due",
    )
    .slice(0, 10);
}
