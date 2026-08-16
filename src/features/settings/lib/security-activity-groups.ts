import type { OwnAccountSecurityActivity } from "@/features/settings/server/account-activity";

export const SECURITY_ACTIVITY_GROUP_WINDOW_MS = 5 * 60 * 1000;

export type SecurityActivityGroup = {
  count: number;
  event: OwnAccountSecurityActivity;
  oldestCreatedAt: string;
};

function activitySignature(event: OwnAccountSecurityActivity) {
  return [
    event.action,
    event.outcome,
    event.channel,
    event.client?.id ?? "",
    event.network ?? "",
    event.device ?? "",
  ].join("\u0000");
}

export function groupSecurityActivity(
  events: readonly OwnAccountSecurityActivity[],
): SecurityActivityGroup[] {
  return events.reduce<SecurityActivityGroup[]>((groups, event) => {
    const previous = groups.at(-1);
    const eventTime = new Date(event.createdAt).getTime();
    const previousNewestTime = previous
      ? new Date(previous.event.createdAt).getTime()
      : Number.NaN;
    const canGroup =
      event.outcome === "success" &&
      previous?.event.outcome === "success" &&
      activitySignature(previous.event) === activitySignature(event) &&
      Number.isFinite(eventTime) &&
      Number.isFinite(previousNewestTime) &&
      previousNewestTime - eventTime <= SECURITY_ACTIVITY_GROUP_WINDOW_MS;

    if (canGroup && previous) {
      previous.count += 1;
      previous.oldestCreatedAt = event.createdAt;
    } else {
      groups.push({ count: 1, event, oldestCreatedAt: event.createdAt });
    }
    return groups;
  }, []);
}
