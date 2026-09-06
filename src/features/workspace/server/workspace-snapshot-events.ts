import { isUpcomingEventAt } from "./workspace-snapshot-helpers";

type AssistantWorkspaceEvent = {
  at: Date | string | null;
  type: string;
};

type AssistantDeadlineEvent = AssistantWorkspaceEvent & {
  type: "homework_due" | "exam" | "todo_due";
};

export function assistantNextClass(
  events: readonly AssistantWorkspaceEvent[],
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
  events: readonly AssistantWorkspaceEvent[],
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
